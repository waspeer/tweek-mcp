/**
 * HTTP client types and interfaces
 */

export interface HttpClientConfig {
  baseUrl: string
  apiKey: string
  timeoutMs: number
}

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: string | object
  timeout?: number
}

export interface HttpResponse<T = unknown> {
  status: number
  statusText: string
  headers: Headers
  data: T
}

export interface RetryConfig {
  maxAttempts: number
  initialDelayMs: number
  maxDelayMs: number
  jitterFactor: number
}

export enum HttpErrorType {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  NOT_FOUND = 'NOT_FOUND',
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
  UNAVAILABLE = 'UNAVAILABLE',
  UNKNOWN = 'UNKNOWN',
}

export class HttpError extends Error {
  constructor(
    public readonly type: HttpErrorType,
    public readonly status: number,
    public readonly statusText: string,
    message?: string,
    public readonly response?: unknown,
  ) {
    super(message ?? `HTTP ${status}: ${statusText}`)
    this.name = 'HttpError'
    Object.setPrototypeOf(this, HttpError.prototype)
  }
}

export type IdempotentMethod = 'GET' | 'DELETE'
export type NonIdempotentMethod = 'POST' | 'PUT' | 'PATCH'
