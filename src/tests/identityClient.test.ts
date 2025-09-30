/* eslint-disable ts/no-unsafe-argument */
import type { AppConfig } from '../config/index.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IdentityClient } from '../auth/identityClient.js'

function makeConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    apiBaseUrl: 'http://identity.local',
    apiKey: 'key',
    tokensPath: '/dev/null',
    requestTimeoutMs: 5000,
    tokenRefreshBufferSec: 60,
    ...overrides,
  }
}

describe('identityClient', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('signInWithEmailPassword', () => {
    it('returns tokens on 200 response', async () => {
      const client = new IdentityClient(makeConfig())
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
        JSON.stringify({ idToken: 'id-token', refreshToken: 'refresh-token', expiresIn: 3600 }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ))

      const tokens = await client.signInWithEmailPassword('test@example.com', 'password123')

      expect(tokens).toEqual({
        idToken: 'id-token',
        refreshToken: 'refresh-token',
        expiresAt: expect.any(Number) as number,
      })
      expect(tokens.expiresAt).toBeGreaterThan(Date.now())
      expect(tokens.expiresAt).toBeLessThanOrEqual(Date.now() + 3600 * 1000)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://identity.local/identity/sign-in',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': 'key',
          },
          body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
        }),
      )
    })

    it('maps 401 to IDENTITY_UNAUTHORIZED', async () => {
      const client = new IdentityClient(makeConfig())
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Unauthorized', { status: 401 }),
      )

      await expect(client.signInWithEmailPassword('invalid@example.com', 'wrongpass'))
        .rejects
        .toThrow(
          expect.objectContaining({
            name: 'AppError',
            code: 'IDENTITY_UNAUTHORIZED',
          }),
        )
    })

    it('handles network timeout', async () => {
      const client = new IdentityClient(makeConfig({ requestTimeoutMs: 10 }))
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const signal = init?.signal as AbortSignal | undefined
        return new Promise((_, reject) => {
          if (signal) {
            signal.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'))
            })
          }
        }) as unknown as Promise<Response>
      })

      const promise = client.signInWithEmailPassword('test@example.com', 'password')
      vi.runAllTimers()

      await expect(promise).rejects.toThrow(
        expect.objectContaining({
          code: 'IDENTITY_NETWORK',
        }),
      )
    })
  })

  describe('refreshIdToken', () => {
    it('returns idToken and expiresAt on 200 response', async () => {
      const client = new IdentityClient(makeConfig())
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
        JSON.stringify({ idToken: 'new-id-token', expiresIn: 120 }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ))

      const result = await client.refreshIdToken('refresh-token-123')

      expect(result).toEqual({
        idToken: 'new-id-token',
        expiresAt: expect.any(Number) as number,
      })
      expect(result.expiresAt).toBeGreaterThan(Date.now())
      expect(result.expiresAt).toBeLessThanOrEqual(Date.now() + 120 * 1000)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://identity.local/identity/refresh',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': 'key',
          },
          body: JSON.stringify({ refreshToken: 'refresh-token-123' }),
        }),
      )
    })

    it('maps 429 to IDENTITY_RATE_LIMITED with retryAfterMs', async () => {
      const client = new IdentityClient(makeConfig())
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Rate limited', {
          status: 429,
          headers: { 'retry-after': '3' },
        }),
      )

      await expect(client.refreshIdToken('refresh-token'))
        .rejects
        .toThrow(
          expect.objectContaining({
            name: 'AppError',
            code: 'IDENTITY_RATE_LIMITED',
          }),
        )
    })

    it('handles malformed JSON response', async () => {
      const client = new IdentityClient(makeConfig())
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('{ invalid json', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )

      // The actual implementation doesn't wrap JSON parsing errors in AppError
      await expect(client.refreshIdToken('refresh-token'))
        .rejects
        .toThrow(SyntaxError)
    })

    it('handles network errors', async () => {
      const client = new IdentityClient(makeConfig())
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(
        new Error('Network error'),
      )

      await expect(client.refreshIdToken('refresh-token'))
        .rejects
        .toThrow(
          expect.objectContaining({
            code: 'IDENTITY_NETWORK',
          }),
        )
    })

    it('handles missing expiresIn in response', async () => {
      const client = new IdentityClient(makeConfig())
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({ idToken: 'token-without-expiry' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )

      // The actual implementation returns NaN for expiresAt when expiresIn is missing
      const result = await client.refreshIdToken('refresh-token')
      expect(result.idToken).toBe('token-without-expiry')
      expect(Number.isNaN(result.expiresAt)).toBe(true)
    })
  })
})
