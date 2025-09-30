/**
 * Shared error handling utilities for MCP tools
 */

import { AppError } from '../auth/errors.js'
import { HttpError } from '../http/types.js'
import { ValidationError } from './validation.js'

/**
 * Wraps errors from tool operations into consistent Error format
 * Preserves HttpError instances as Error, converts ValidationError and AppError to Error,
 * and wraps unexpected errors with context
 */
export function wrapToolError(error: unknown, operation: string): Error {
  if (error instanceof HttpError) {
    return new Error(`HTTP error (${error.type}): ${error.message}`, { cause: error })
  }

  if (error instanceof ValidationError) {
    return new Error(`Validation error: ${error.message}`, { cause: error })
  }

  if (error instanceof AppError) {
    return new Error(`Authentication error (${error.code}): ${error.message}`, { cause: error })
  }

  return new Error(
    `Failed to ${operation}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    { cause: error instanceof Error ? error : undefined },
  )
}

/**
 * Formats tool response data consistently
 */
export function formatToolResponse(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  }
}

/**
 * Validates that arguments is a proper object before type casting
 */
export function validateArguments(args: unknown, toolName: string): asserts args is Record<string, unknown> {
  if (args == null || typeof args !== 'object' || Array.isArray(args)) {
    throw new Error(`Invalid arguments for ${toolName}: expected object`)
  }
}
