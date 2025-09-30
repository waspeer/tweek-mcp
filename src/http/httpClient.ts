/**
 * HTTP client wrapper over Node 20 fetch with timeout and header redaction
 */

import { AppConfig } from '../config/index.js'
import { HttpClientConfig, HttpRequestOptions, HttpResponse } from './types.js'
import { createHttpError } from './errors.js'
import { withRetry, createRetryConfig } from './retry.js'

/**
 * Sensitive headers that should be redacted in logs
 */
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'x-api-key',
  'cookie',
  'x-auth-token'
])

/**
 * Redacts sensitive headers for safe logging
 */
function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {}
  
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]'
    } else {
      redacted[key] = value
    }
  }
  
  return redacted
}

/**
 * HTTP client wrapper with timeout, error handling, and retry logic
 */
interface Logger {
  log: (message: string, meta?: any) => void
  error: (message: string, meta?: any) => void
}

export class HttpClient {
  private readonly config: HttpClientConfig
  private authToken?: string
  private readonly logger: Logger
  private readonly retryConfig: RetryConfig
  
  constructor(appConfig: AppConfig, logger?: Logger, retryConfig?: Partial<RetryConfig>) {
    this.config = {
      baseUrl: appConfig.apiBaseUrl,
      apiKey: appConfig.apiKey,
      timeoutMs: appConfig.requestTimeoutMs
    }
    this.logger = logger || { 
      log: () => {}, 
      error: () => {} 
    }
    this.retryConfig = createRetryConfig(retryConfig || {})
  }
  
  /**
   * Makes an HTTP request with optional retry logic
   */
  async request<T = unknown>(
    path: string,
    options: HttpRequestOptions = {}
  ): Promise<HttpResponse<T>> {
    // Input validation
    if (!path || typeof path !== 'string') {
      throw new Error('Path must be a non-empty string')
    }
    if (options && typeof options !== 'object') {
      throw new Error('Options must be an object')
    }
    
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.config.timeoutMs
    } = options
    
    const url = new URL(path, this.config.baseUrl).toString()
    
    // Merge default headers with custom headers
    const requestHeaders: Record<string, string> = {
      'x-api-key': this.config.apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'tweek-mcp/1.0.0',
      ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` }),
      ...headers
    }
    
    // Log the request (with redacted headers)
    const startTime = Date.now()
    this.logger.log(`HTTP ${method} ${path}`, {
      headers: redactHeaders(requestHeaders)
    })
    
    const operation = async (): Promise<HttpResponse<T>> => {
      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)
      
      try {
        // Prepare request body
        let requestBody: string | undefined
        if (body !== undefined) {
          requestBody = typeof body === 'string' ? body : JSON.stringify(body)
        }
        
        // Make the request
        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body: requestBody,
          signal: controller.signal
        })
        
        // Clear timeout
        clearTimeout(timeoutId)
        
        // Log response
        const duration = Date.now() - startTime
        this.logger.log(`HTTP ${method} ${path} → ${response.status} ${response.statusText} (${duration}ms)`)
        
        // Handle error responses
        if (!response.ok) {
          throw await createHttpError(response)
        }
        
        // Parse response body
        let data: T
        const contentType = response.headers.get('content-type') || ''
        
        if (contentType.includes('application/json')) {
          data = await response.json()
        } else {
          // For non-JSON responses, return the text as data
          data = (await response.text()) as unknown as T
        }
        
        return {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data
        }
        
      } catch (error) {
        clearTimeout(timeoutId)
        
        // Handle timeout errors
        if (error instanceof Error && error.name === 'AbortError') {
          const duration = Date.now() - startTime
          this.logger.error(`HTTP ${method} ${path} → TIMEOUT (${duration}ms)`)
          throw new Error(`${method} ${url} timed out after ${timeout}ms`)
        }
        
        // Re-throw other errors
        throw error
      }
    }
    
    // Execute with retry logic for idempotent methods
    return withRetry(operation, method, this.retryConfig)
  }
  
  /**
   * Convenience method for GET requests
   */
  async get<T = unknown>(path: string, options?: Omit<HttpRequestOptions, 'method' | 'body'>): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'GET' })
  }
  
  /**
   * Convenience method for POST requests
   */
  async post<T = unknown>(path: string, body?: any, options?: Omit<HttpRequestOptions, 'method' | 'body'>): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'POST', body })
  }
  
  /**
   * Convenience method for PUT requests
   */
  async put<T = unknown>(path: string, body?: any, options?: Omit<HttpRequestOptions, 'method' | 'body'>): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'PUT', body })
  }
  
  /**
   * Convenience method for PATCH requests
   */
  async patch<T = unknown>(path: string, body?: any, options?: Omit<HttpRequestOptions, 'method' | 'body'>): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'PATCH', body })
  }
  
  /**
   * Convenience method for DELETE requests
   */
  async delete<T = unknown>(path: string, options?: Omit<HttpRequestOptions, 'method' | 'body'>): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'DELETE' })
  }
  
  /**
   * Updates the authorization header for authenticated requests
   */
  setAuthorizationHeader(token: string): void {
    this.authToken = token
  }
}