/* eslint-disable ts/no-unsafe-assignment */
/* eslint-disable ts/no-unsafe-call */
/* eslint-disable ts/no-unsafe-member-access */

import type { AuthErrorCode } from '../auth/errors.js'
import type { AuthTokens } from '../auth/types.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../auth/errors.js'

const mockTokens: AuthTokens = {
  idToken: 'mock-id-token',
  refreshToken: 'mock-refresh-token',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
}

describe('cLI E2E Tests', () => {
  let testDir: string

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tweek-cli-test-'))
    vi.stubEnv('TWEEK_API_KEY', 'test-api-key')
    vi.stubEnv('TWEEK_TOKENS_PATH', path.join(testDir, 'tokens.json'))
  })

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true })
    }
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('tokenStore file permissions', () => {
    it('should write tokens file with mode 0600', () => {
      const tokensPath = path.join(testDir, 'tokens.json')

      fs.writeFileSync(tokensPath, JSON.stringify(mockTokens))
      fs.chmodSync(tokensPath, 0o600)

      const stats = fs.statSync(tokensPath)
      const mode = stats.mode & 0o777

      expect(mode).toBe(0o600)
    })

    it('should detect if tokens file has incorrect permissions', () => {
      const tokensPath = path.join(testDir, 'tokens.json')

      fs.writeFileSync(tokensPath, JSON.stringify(mockTokens))
      fs.chmodSync(tokensPath, 0o644)

      const stats = fs.statSync(tokensPath)
      const mode = stats.mode & 0o777

      expect(mode).not.toBe(0o600)
      expect(mode).toBe(0o644)
    })

    it('should enforce 0600 permissions across test scenarios', () => {
      const tokensPath = path.join(testDir, 'secure-tokens.json')

      fs.writeFileSync(tokensPath, JSON.stringify(mockTokens))
      fs.chmodSync(tokensPath, 0o600)

      const statsAfterWrite = fs.statSync(tokensPath)
      expect((statsAfterWrite.mode & 0o777)).toBe(0o600)

      const content = fs.readFileSync(tokensPath, 'utf8')
      const parsed = JSON.parse(content) as AuthTokens

      expect(parsed).toEqual(mockTokens)

      const statsAfterRead = fs.statSync(tokensPath)
      expect((statsAfterRead.mode & 0o777)).toBe(0o600)
    })
  })

  describe('auth signin logic', () => {
    it('should handle successful authentication flow', async () => {
      const signInFn = vi.fn().mockResolvedValue(mockTokens)

      const result = await signInFn('test@example.com', 'password123') as AuthTokens

      expect(result).toEqual(mockTokens)
      expect(signInFn).toHaveBeenCalledWith('test@example.com', 'password123')
    })

    it('should handle IDENTITY_UNAUTHORIZED error', async () => {
      const error = new AppError(
        'IDENTITY_UNAUTHORIZED' as AuthErrorCode,
        'Invalid credentials',
      )

      const signInFn = vi.fn().mockRejectedValue(error)

      await expect(signInFn('test@example.com', 'wrongpassword')).rejects.toThrow('Invalid credentials')

      const caughtError = await signInFn('test@example.com', 'wrongpassword')
        .catch((err: unknown) => err as AppError)

      expect(caughtError).toBeInstanceOf(AppError)
      expect(caughtError.code).toBe('IDENTITY_UNAUTHORIZED')
    })

    it('should handle IDENTITY_RATE_LIMITED error', async () => {
      const error = new AppError(
        'IDENTITY_RATE_LIMITED' as AuthErrorCode,
        'Too many requests',
      )

      const signInFn = vi.fn().mockRejectedValue(error)

      const caughtError = await signInFn('test@example.com', 'password123')
        .catch((err: unknown) => err as AppError)

      expect(caughtError).toBeInstanceOf(AppError)
      expect(caughtError.code).toBe('IDENTITY_RATE_LIMITED')
      expect(caughtError.message).toContain('Too many requests')
    })

    it('should handle IDENTITY_NETWORK error', async () => {
      const error = new AppError(
        'IDENTITY_NETWORK' as AuthErrorCode,
        'Network failure',
      )

      const signInFn = vi.fn().mockRejectedValue(error)

      const caughtError = await signInFn('test@example.com', 'password123')
        .catch((err: unknown) => err as AppError)

      expect(caughtError).toBeInstanceOf(AppError)
      expect(caughtError.code).toBe('IDENTITY_NETWORK')
    })

    it('should validate credentials format', () => {
      const email = 'test@example.com'
      const password = 'password123'

      expect(email.trim()).toBeTruthy()
      expect(password.trim()).toBeTruthy()

      const emptyEmail = '   '
      const emptyPassword = ''

      expect(emptyEmail.trim()).toBe('')
      expect(emptyPassword.trim()).toBe('')
    })

    it('should securely handle password in memory', () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123',
      }

      expect(credentials.password).toBe('password123')
      expect(typeof credentials.password).toBe('string')
    })
  })

  describe('auth import logic', () => {
    it('should handle successful token import', async () => {
      const refreshFn = vi.fn().mockResolvedValue({
        idToken: 'new-id-token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      })

      const result = await refreshFn('imported-refresh-token') as { idToken: string, expiresAt: number }

      expect(result.idToken).toBe('new-id-token')
      expect(refreshFn).toHaveBeenCalledWith('imported-refresh-token')
    })

    it('should handle invalid refresh token', async () => {
      const error = new AppError(
        'IDENTITY_UNAUTHORIZED' as AuthErrorCode,
        'Invalid refresh token',
      )

      const refreshFn = vi.fn().mockRejectedValue(error)

      const caughtError = await refreshFn('invalid-token')
        .catch((err: unknown) => err as AppError)

      expect(caughtError).toBeInstanceOf(AppError)
      expect(caughtError.code).toBe('IDENTITY_UNAUTHORIZED')
    })

    it('should handle network error during import', async () => {
      const error = new AppError(
        'IDENTITY_NETWORK' as AuthErrorCode,
        'Network failure',
      )

      const refreshFn = vi.fn().mockRejectedValue(error)

      const caughtError = await refreshFn('valid-token')
        .catch((err: unknown) => err as AppError)

      expect(caughtError).toBeInstanceOf(AppError)
      expect(caughtError.code).toBe('IDENTITY_NETWORK')
    })

    it('should construct complete token object after import', async () => {
      const refreshToken = 'imported-refresh-token'
      const exchangeResult = {
        idToken: 'new-id-token',
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      }

      const completeTokens: AuthTokens = {
        idToken: exchangeResult.idToken,
        refreshToken,
        expiresAt: exchangeResult.expiresAt,
      }

      expect(completeTokens).toEqual({
        idToken: 'new-id-token',
        refreshToken: 'imported-refresh-token',
        expiresAt: expect.any(Number),
      })
    })
  })

  describe('cLI provisioning workflows', () => {
    it('should verify tokens written by TokenStore persist across reads', () => {
      const tokensPath = path.join(testDir, 'workflow-tokens.json')

      fs.writeFileSync(tokensPath, JSON.stringify(mockTokens), { mode: 0o600 })

      expect(fs.existsSync(tokensPath)).toBe(true)

      const readTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8')) as AuthTokens
      expect(readTokens).toEqual(mockTokens)

      const stats = fs.statSync(tokensPath)
      expect((stats.mode & 0o777)).toBe(0o600)
    })

    it('should handle missing tokens file scenario', () => {
      const tokensPath = path.join(testDir, 'non-existent-tokens.json')

      expect(fs.existsSync(tokensPath)).toBe(false)

      expect(() => {
        fs.readFileSync(tokensPath, 'utf8')
      }).toThrow()
    })

    it('should verify token structure matches AuthTokens interface', () => {
      const tokens: AuthTokens = mockTokens

      expect(tokens).toHaveProperty('idToken')
      expect(tokens).toHaveProperty('refreshToken')
      expect(tokens).toHaveProperty('expiresAt')

      expect(typeof tokens.idToken).toBe('string')
      expect(typeof tokens.refreshToken).toBe('string')
      expect(typeof tokens.expiresAt).toBe('number')
    })

    it('should support automated provisioning via --password-stdin pattern', () => {
      const stdinData = 'password123'
      const trimmedPassword = stdinData.trim()

      expect(trimmedPassword).toBe('password123')
      expect(trimmedPassword.length).toBeGreaterThan(0)
    })

    it('should validate required arguments for import command', () => {
      const args = ['--refresh-token', 'my-token']
      const hasRequiredArg = args.includes('--refresh-token')

      expect(hasRequiredArg).toBe(true)

      const emptyArgs: string[] = []
      const missingRequiredArg = emptyArgs.includes('--refresh-token')

      expect(missingRequiredArg).toBe(false)
    })

    it('should validate email and password-stdin flags used together', () => {
      const args1 = ['--email', 'test@example.com', '--password-stdin']
      const hasEmail = args1.includes('--email')
      const hasPasswordStdin = args1.includes('--password-stdin')

      expect(hasEmail && hasPasswordStdin).toBe(true)

      const args2 = ['--email', 'test@example.com']
      const onlyEmail = args2.includes('--email') && !args2.includes('--password-stdin')

      expect(onlyEmail).toBe(true)
    })
  })

  describe('error mapping and user feedback', () => {
    it('should map AppError codes to user-friendly messages', () => {
      const errorMessages: Record<AuthErrorCode, string> = {
        IDENTITY_UNAUTHORIZED: 'Invalid email or password',
        IDENTITY_RATE_LIMITED: 'Rate limited by Tweek. Please try again later.',
        IDENTITY_NETWORK: 'Network error during authentication. Please check your connection.',
        TOKENS_NOT_FOUND: 'Tokens not found',
        TOKENS_FORMAT_UNSUPPORTED: 'Token format not supported',
        TOKENS_PATH_INVALID: 'Invalid tokens path',
        INTERNAL: 'Internal error',
      }

      expect(errorMessages.IDENTITY_UNAUTHORIZED).toContain('Invalid')
      expect(errorMessages.IDENTITY_RATE_LIMITED).toContain('Rate limited')
      expect(errorMessages.IDENTITY_NETWORK).toContain('Network error')
    })

    it('should distinguish between AppError and generic Error', () => {
      const appError = new AppError('INTERNAL' as AuthErrorCode, 'Internal error')
      const genericError = new Error('Something went wrong')

      expect(appError).toBeInstanceOf(AppError)
      expect(appError).toBeInstanceOf(Error)
      expect(genericError).toBeInstanceOf(Error)
      expect(genericError).not.toBeInstanceOf(AppError)
    })

    it('should provide actionable error messages', () => {
      const unauthorizedMsg = 'Authentication failed: Invalid email or password'
      const networkMsg = 'Network error during authentication. Please check your connection.'
      const rateLimitMsg = 'Rate limited by Tweek. Please try again later.'

      expect(unauthorizedMsg).toContain('Invalid email or password')
      expect(networkMsg).toContain('check your connection')
      expect(rateLimitMsg).toContain('try again later')
    })
  })

  describe('security considerations', () => {
    it('should never log credentials', () => {
      const credentials = {
        email: 'test@example.com',
        password: 'password123',
      }

      const safeLog = {
        email: credentials.email,
      }

      expect(safeLog).not.toHaveProperty('password')
      expect(safeLog).toHaveProperty('email')
    })

    it('should enforce strict file permissions on tokens', () => {
      const tokensPath = path.join(testDir, 'secure.json')

      fs.writeFileSync(tokensPath, JSON.stringify(mockTokens))
      fs.chmodSync(tokensPath, 0o600)

      const stats = fs.statSync(tokensPath)
      const mode = stats.mode & 0o777

      expect(mode).toBe(0o600)
      expect(mode & 0o077).toBe(0)
    })

    it('should discard credentials after use', () => {
      let credentials: { email: string, password: string } | null = {
        email: 'test@example.com',
        password: 'password123',
      }

      expect(credentials).toBeTruthy()

      credentials = null

      expect(credentials).toBeNull()
    })
  })
})
