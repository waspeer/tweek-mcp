/**
 * HTTP client wrapper over Node 20 fetch with timeout and header redaction
 */

import type { AppConfig } from '../config/index.js'
import type { HttpClientConfig, HttpRequestOptions, HttpResponse, RetryConfig } from './types.js'
import { createHttpError } from './errors.js'
import { createRetryConfig, withRetry } from './retry.js'

/**
 * Sensitive headers that should be redacted in logs
 */
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'x-api-key',
  'cookie',
  'x-auth-token',
])

/**
 * Redacts sensitive headers for safe logging
 */
function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {}

  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]'
    }
    else {
      redacted[key] = value
    }
  }

  return redacted
}

/**
 * Checks if two header objects are equivalent
 */
function headersEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length)
    return false

  return keysA.every(key => a[key] === b[key])
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
  private lastHeaders?: Record<string, string>
  private cachedRedactedHeaders?: Record<string, string>

  constructor(appConfig: AppConfig, logger?: Logger, retryConfig?: Partial<RetryConfig>) {
    this.config = {
      baseUrl: appConfig.apiBaseUrl,
      apiKey: appConfig.apiKey,
      timeoutMs: appConfig.requestTimeoutMs,
    }
    this.logger = logger || {
      log: (message: string, meta?: any) => {
        // eslint-disable-next-line no-console
        console.log(message, meta)
      },
      error: (message: string, meta?: any) => console.error(message, meta),
    }
    this.retryConfig = createRetryConfig(retryConfig || {})
  }

  /**
   * Gets redacted headers with caching to improve performance
   */
  private getRedactedHeaders(headers: Record<string, string>): Record<string, string> {
    // Use cached redacted headers if the headers haven't changed
    if (this.lastHeaders && this.cachedRedactedHeaders && headersEqual(headers, this.lastHeaders)) {
      return this.cachedRedactedHeaders
    }

    // Cache the new headers and their redacted version
    this.lastHeaders = { ...headers }
    this.cachedRedactedHeaders = redactHeaders(headers)

    return this.cachedRedactedHeaders
  }

  /**
   * Makes an HTTP request with optional retry logic
   */
  async request<T = unknown>(
    path: string,
    options: HttpRequestOptions = {},
  ): Promise<HttpResponse<T>> {
    // Enhanced input validation
    if (!path || typeof path !== 'string') {
      throw new Error('Path must be a non-empty string')
    }
    if (path.trim() === '') {
      throw new Error('Path cannot be empty or whitespace-only')
    }
    if (options != null && typeof options !== 'object') {
      throw new Error('Options must be an object')
    }
    if (options != null && Array.isArray(options)) {
      throw new Error('Options cannot be an array')
    }

    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.config.timeoutMs,
    } = options

    // Validate timeout value
    if (timeout != null && (typeof timeout !== 'number' || timeout < 0 || !Number.isFinite(timeout))) {
      throw new Error('Timeout must be a non-negative finite number')
    }

    // Validate and construct URL
    let url: string
    try {
      url = new URL(path, this.config.baseUrl).toString()
    }
    catch (urlError) {
      const cause = urlError instanceof Error ? urlError : new Error(String(urlError))
      throw new Error(`Invalid URL: ${cause.message}`, { cause })
    }

    // Merge default headers with custom headers
    const requestHeaders: Record<string, string> = {
      'x-api-key': this.config.apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'tweek-mcp/1.0.0',
      ...(this.authToken != null && this.authToken !== '' ? { Authorization: `Bearer ${this.authToken}` } : {}),
      ...headers,
    }

    // Log the request (with redacted headers)
    const startTime = Date.now()
    this.logger.log(`HTTP ${method} ${path}`, {
      headers: this.getRedactedHeaders(requestHeaders),
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
          signal: controller.signal,
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
        const contentType = response.headers.get('content-type') ?? ''

        if (contentType.includes('application/json')) {
          data = await response.json() as T
        }
        else {
          // For non-JSON responses, return the text as data
          data = (await response.text()) as unknown as T
        }

        return {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data,
        }
      }
      catch (error) {
        clearTimeout(timeoutId)

        // Handle timeout errors
        if (error instanceof Error && error.name === 'AbortError') {
          const duration = Date.now() - startTime
          this.logger.error(`HTTP ${method} ${path} → TIMEOUT (${duration}ms)`)
          throw new Error(`${method} ${url} timed out after ${timeout}ms`, { cause: error })
        }

        // Re-throw other errors (coerce non-Error values)
        if (!(error instanceof Error)) {
          throw new Error(`Request failed: ${String(error)}`)
        }
        throw error
      }
    }

    // Execute with retry logic for idempotent methods
    return withRetry(operation, method, this.retryConfig, this.logger)
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
  async post<T = unknown>(path: string, body?: string | object, options?: Omit<HttpRequestOptions, 'method' | 'body'>): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'POST', body })
  }

  /**
   * Convenience method for PUT requests
   */
  async put<T = unknown>(path: string, body?: string | object, options?: Omit<HttpRequestOptions, 'method' | 'body'>): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'PUT', body })
  }

  /**
   * Convenience method for PATCH requests
   */
  async patch<T = unknown>(path: string, body?: string | object, options?: Omit<HttpRequestOptions, 'method' | 'body'>): Promise<HttpResponse<T>> {
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
