/**
 * HTTP error mapping and utilities
 */

import { HttpError, HttpErrorType } from './types.js'

/**
 * Maps HTTP status codes to structured MCP error types
 */
export function mapHttpStatusToErrorType(status: number): HttpErrorType {
  if (status === 401 || status === 403) {
    return HttpErrorType.UNAUTHENTICATED
  }
  
  if (status === 404) {
    return HttpErrorType.NOT_FOUND
  }
  
  if (status === 400) {
    return HttpErrorType.INVALID_ARGUMENT
  }
  
  if (status === 429) {
    return HttpErrorType.RESOURCE_EXHAUSTED
  }
  
  if (status >= 500 && status < 600) {
    return HttpErrorType.UNAVAILABLE
  }
  
  return HttpErrorType.UNKNOWN
}

/**
 * Creates a structured HttpError from a fetch Response
 */
export async function createHttpError(
  response: Response,
  customMessage?: string
): Promise<HttpError> {
  const errorType = mapHttpStatusToErrorType(response.status)
  
  let responseData: any
  try {
    // Try to parse JSON error response
    const text = await response.text()
    if (text) {
      try {
        responseData = JSON.parse(text)
      } catch {
        // For non-JSON responses, include the raw text
        responseData = { message: text }
      }
    }
  } catch {
    // Ignore parse errors, responseData will be undefined
  }
  
  return new HttpError(
    errorType,
    response.status,
    response.statusText,
    customMessage,
    responseData
  )
}

/**
 * Checks if an HTTP status code represents a server error that should be retried
 */
export function isRetriableError(status: number): boolean {
  return status >= 500 && status < 600
}

/**
 * Checks if an error is an HttpError with a specific type
 */
export function isHttpErrorOfType(error: unknown, type: HttpErrorType): boolean {
  return error instanceof HttpError && error.type === type
}