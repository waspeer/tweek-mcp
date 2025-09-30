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
  customMessage?: string,
): Promise<HttpError> {
  const errorType = mapHttpStatusToErrorType(response.status)

  let responseData: unknown
  try {
    // Try to parse JSON error response
    const text = await response.text()
    if (text) {
      try {
        responseData = JSON.parse(text) as unknown
      }
      catch (parseError) {
        // For non-JSON responses with meaningful content, include the raw text
        // Don't wrap simple text messages in an object for backward compatibility
        if (text.trim()) {
          responseData = { message: text }
        }
        // Log parsing errors for debugging while maintaining graceful fallback
        console.warn(`Failed to parse error response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
      }
    }
  }
  catch (networkError) {
    // Log network errors that prevent reading response body
    console.warn(`Failed to read error response: ${networkError instanceof Error ? networkError.message : 'Unknown error'}`)
  }

  return new HttpError(
    errorType,
    response.status,
    response.statusText,
    customMessage,
    responseData,
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

/**
 * Type guard to check if an error has a status property
 */
export function hasStatusProperty(error: unknown): error is { status: number } {
  return typeof error === 'object'
    && error !== null
    && 'status' in error
    && typeof (error as { status: unknown }).status === 'number'
}

/**
 * Checks if an error is retriable based on its status code
 */
export function isRetriableErrorObject(error: unknown): boolean {
  if (error instanceof HttpError) {
    return isRetriableError(error.status)
  }

  if (hasStatusProperty(error)) {
    return isRetriableError(error.status)
  }

  return false
}
