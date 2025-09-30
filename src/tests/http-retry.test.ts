import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  calculateRetryDelay,
  createRetryConfig,
  isIdempotentMethod,
  withRetry,
} from '../http/retry.js'
import { HttpError, HttpErrorType } from '../http/types.js'

describe('hTTP retry logic', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('isIdempotentMethod', () => {
    it('returns true for GET and DELETE', () => {
      expect(isIdempotentMethod('GET')).toBe(true)
      expect(isIdempotentMethod('DELETE')).toBe(true)
    })

    it('returns false for non-idempotent methods', () => {
      expect(isIdempotentMethod('POST')).toBe(false)
      expect(isIdempotentMethod('PUT')).toBe(false)
      expect(isIdempotentMethod('PATCH')).toBe(false)
    })

    it('is case sensitive', () => {
      expect(isIdempotentMethod('get')).toBe(false)
      expect(isIdempotentMethod('delete')).toBe(false)
    })
  })

  describe('calculateRetryDelay', () => {
    const config = createRetryConfig({
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      jitterFactor: 0.1,
    })

    beforeEach(() => {
      // Mock Math.random to return consistent values for testing
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
    })

    it('calculates exponential backoff correctly', () => {
      // With jitter factor 0.1 and Math.random() = 0.5:
      // jitter = cappedDelay * 0.1 * (0.5 - 0.5) = 0

      const delay1 = calculateRetryDelay(1, config)
      expect(delay1).toBe(1000) // 1000 * 2^0 = 1000

      const delay2 = calculateRetryDelay(2, config)
      expect(delay2).toBe(2000) // 1000 * 2^1 = 2000

      const delay3 = calculateRetryDelay(3, config)
      expect(delay3).toBe(4000) // 1000 * 2^2 = 4000
    })

    it('caps delay at maxDelayMs', () => {
      const delay = calculateRetryDelay(10, config)
      expect(delay).toBe(10000) // Should be capped at maxDelayMs
    })

    it('adds jitter to prevent thundering herd', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0.3) // -0.2 from center

      const delay = calculateRetryDelay(1, config)
      const expectedJitter = 1000 * 0.1 * (0.3 - 0.5) // -20
      expect(delay).toBe(1000 + expectedJitter) // 980
    })

    it('ensures delay is never negative', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0) // Maximum negative jitter

      const config = createRetryConfig({
        initialDelayMs: 100,
        jitterFactor: 2.0, // Large jitter factor
      })

      const delay = calculateRetryDelay(1, config)
      expect(delay).toBeGreaterThanOrEqual(0)
    })

    it('uses default config when not provided', () => {
      const delay = calculateRetryDelay(1)
      expect(delay).toBeGreaterThanOrEqual(0)
      expect(delay).toBeLessThanOrEqual(10000)
    })
  })

  describe('withRetry', () => {
    it('executes operation once for successful calls', async () => {
      const operation = vi.fn().mockResolvedValue('success')

      const result = await withRetry(operation, 'GET')

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('does not retry non-idempotent methods', async () => {
      const error = new HttpError(HttpErrorType.UNAVAILABLE, 500, 'Internal Server Error')
      const operation = vi.fn().mockRejectedValue(error)

      await expect(withRetry(operation, 'POST')).rejects.toThrow(error)
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('retries idempotent methods on 5xx errors', async () => {
      const error = new HttpError(HttpErrorType.UNAVAILABLE, 503, 'Service Unavailable')
      Object.assign(error, { status: 503 }) // Add status property for retry logic

      const operation = vi.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success')

      const promise = withRetry(operation, 'GET', createRetryConfig({ maxAttempts: 3 }))

      // Fast-forward through the delays
      await vi.runAllTimersAsync()

      const result = await promise
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('does not retry non-5xx errors', async () => {
      const error = new HttpError(HttpErrorType.NOT_FOUND, 404, 'Not Found')
      Object.assign(error, { status: 404 })

      const operation = vi.fn().mockRejectedValue(error)

      await expect(withRetry(operation, 'GET')).rejects.toThrow(error)
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('gives up after max attempts', async () => {
      const error = new HttpError(HttpErrorType.UNAVAILABLE, 500, 'Internal Server Error')
      Object.assign(error, { status: 500 })

      const operation = vi.fn().mockRejectedValue(error)

      const promise = withRetry(operation, 'GET', createRetryConfig({ maxAttempts: 2 })).catch(error => error as Error)

      await vi.runAllTimersAsync()

      const result = await promise
      expect(result).toBe(error)
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('handles errors without status property', async () => {
      const error = new Error('Network error')
      const operation = vi.fn().mockRejectedValue(error)

      await expect(withRetry(operation, 'GET')).rejects.toThrow(error)
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('logs retry attempts', async () => {
      const mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() }

      const error = new HttpError(HttpErrorType.UNAVAILABLE, 502, 'Bad Gateway')
      Object.assign(error, { status: 502 })

      const operation = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success')

      const promise = withRetry(operation, 'DELETE', createRetryConfig({ maxAttempts: 2 }), mockLogger)

      await vi.runAllTimersAsync()

      await promise

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Retrying request (attempt 2/2)'),
      )
    })
  })

  describe('createRetryConfig', () => {
    it('uses defaults for missing properties', () => {
      const config = createRetryConfig({})

      expect(config.maxAttempts).toBe(3)
      expect(config.initialDelayMs).toBe(1000)
      expect(config.maxDelayMs).toBe(10000)
      expect(config.jitterFactor).toBe(0.1)
    })

    it('overrides defaults with provided values', () => {
      const config = createRetryConfig({
        maxAttempts: 5,
        initialDelayMs: 500,
      })

      expect(config.maxAttempts).toBe(5)
      expect(config.initialDelayMs).toBe(500)
      expect(config.maxDelayMs).toBe(10000) // Still default
      expect(config.jitterFactor).toBe(0.1) // Still default
    })
  })
})
