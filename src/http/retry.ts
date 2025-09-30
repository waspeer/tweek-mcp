/**
 * HTTP retry logic with exponential backoff and jitter
 */

import type { Logger } from '../logging/index.js'
import type { IdempotentMethod, RetryConfig } from './types.js'
import { isRetriableErrorObject } from './errors.js'

/**
 * Base multiplier for exponential backoff calculation
 */
const RETRY_BACKOFF_BASE = 2

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  jitterFactor: 0.1,
}

/**
 * Checks if an HTTP method is idempotent and safe to retry
 */
export function isIdempotentMethod(method: string): method is IdempotentMethod {
  return method === 'GET' || method === 'DELETE'
}

/**
 * Calculates the delay for the next retry attempt using exponential backoff with jitter
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): number {
  const { initialDelayMs, maxDelayMs, jitterFactor } = config

  // Exponential backoff: delay = initialDelay * RETRY_BACKOFF_BASE^(attempt - 1)
  const exponentialDelay = initialDelayMs * RETRY_BACKOFF_BASE ** (attempt - 1)

  // Cap at maxDelayMs
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs)

  // Add jitter to prevent thundering herd
  const jitter = cappedDelay * jitterFactor * (Math.random() - 0.5)

  return Math.max(0, cappedDelay + jitter)
}

/**
 * Sleeps for the specified number of milliseconds
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Executes a function with retry logic for idempotent operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  method: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  logger?: Logger,
): Promise<T> {
  // Only retry idempotent methods
  if (!isIdempotentMethod(method)) {
    return operation()
  }

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation()
    }
    catch (error) {
      lastError = error as Error

      // Only retry on server errors (5xx)
      const shouldRetry = error instanceof Error && isRetriableErrorObject(error)

      // Don't retry if this is the last attempt or if it's not a retriable error
      if (attempt === config.maxAttempts || !shouldRetry) {
        throw error
      }

      // Wait before retrying
      const delay = calculateRetryDelay(attempt, config)
      if (logger) {
        logger.info(`Retrying request (attempt ${attempt + 1}/${config.maxAttempts}) after ${delay}ms`)
      }
      await sleep(delay)
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError || new Error('Unexpected retry loop completion')
}

/**
 * Creates a retry configuration with custom settings
 */
export function createRetryConfig(overrides: Partial<RetryConfig>): RetryConfig {
  return { ...DEFAULT_RETRY_CONFIG, ...overrides }
}
