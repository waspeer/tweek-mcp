/**
 * HTTP client module exports
 */

export { HttpClient } from './httpClient.js'
export { HttpError, HttpErrorType } from './types.js'
export { 
  mapHttpStatusToErrorType, 
  createHttpError, 
  isRetriableError, 
  isHttpErrorOfType 
} from './errors.js'
export { 
  withRetry, 
  createRetryConfig, 
  isIdempotentMethod, 
  calculateRetryDelay 
} from './retry.js'
export type { 
  HttpClientConfig, 
  HttpRequestOptions, 
  HttpResponse, 
  RetryConfig,
  IdempotentMethod,
  NonIdempotentMethod
} from './types.js'