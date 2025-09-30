/* eslint-disable ts/no-unsafe-argument */
import type { AuthTokens } from '../auth/types.js'
import type { AppConfig } from '../config/index.js'
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TokenStore } from '../auth/tokenStore.js'

const FIXED_TIME = new Date('2024-01-01T00:00:00Z').getTime()

function makeConfig(tokensPath: string, encryptionKey?: string): AppConfig {
  return {
    apiBaseUrl: 'http://example.com',
    apiKey: 'key',
    tokensPath,
    requestTimeoutMs: 1000,
    tokenRefreshBufferSec: 60,
    encryptionKey,
  }
}

function tempFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'tweek-tokens-'))
  return join(dir, 'tokens.json')
}

const sampleTokens: AuthTokens = {
  idToken: 'id-token-123',
  refreshToken: 'refresh-token-456',
  expiresAt: FIXED_TIME + 3600_000,
}

describe('tokenStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_TIME)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('without encryption', () => {
    it('writes and reads tokens correctly', () => {
      const file = tempFile()
      const store = new TokenStore(makeConfig(file))

      store.write(sampleTokens)

      // Verify file content is plain JSON
      const onDisk = JSON.parse(readFileSync(file, 'utf8')) as AuthTokens
      expect(onDisk).toEqual(sampleTokens)

      // Verify file permissions are restrictive (600)
      const stats = statSync(file)
      expect((stats.mode & 0o777)).toBe(0o600)

      // Verify read returns same data
      const readTokens = store.read()
      expect(readTokens).toEqual(sampleTokens)
    })
  })

  describe('with encryption', () => {
    const encryptionKey = 'test-encryption-key-32-bytes-long'

    it('writes and reads encrypted tokens correctly', () => {
      const file = tempFile()
      const store = new TokenStore(makeConfig(file, encryptionKey))

      store.write(sampleTokens)

      // Verify file content is encrypted (not plain JSON)
      const onDiskText = readFileSync(file, 'utf8')
      const parsed = JSON.parse(onDiskText) as { v: number, ciphertext: string }

      expect(parsed.v).toBe(1) // version
      expect(typeof parsed.ciphertext).toBe('string')
      expect(parsed.ciphertext).not.toContain('id-token-123')
      expect(parsed.ciphertext).not.toContain('refresh-token-456')

      // Verify read decrypts correctly
      const decryptedTokens = store.read()
      expect(decryptedTokens).toEqual(sampleTokens)
    })

    it('throws error when reading with wrong encryption key', () => {
      const file = tempFile()
      const store1 = new TokenStore(makeConfig(file, 'key1-32-bytes-long-12345678901'))
      const store2 = new TokenStore(makeConfig(file, 'key2-32-bytes-long-12345678901'))

      store1.write(sampleTokens)

      expect(() => store2.read()).toThrow(
        expect.objectContaining({
          name: 'AppError',
          code: 'INTERNAL',
        }),
      )
    })

    it('accepts any length encryption key (derives 32-byte key via SHA-256)', () => {
      const file = tempFile()

      // The actual implementation derives keys via SHA-256, so any length is accepted
      expect(() => new TokenStore(makeConfig(file, 'short-key'))).not.toThrow()

      const store = new TokenStore(makeConfig(file, 'short-key'))
      expect(() => store.write(sampleTokens)).not.toThrow()
      expect(() => store.read()).not.toThrow()
    })
  })

  describe('error handling', () => {
    it('throws TOKENS_NOT_FOUND when file missing', () => {
      const dir = mkdtempSync(join(tmpdir(), 'tweek-missing-'))
      const file = join(dir, 'nonexistent.json')
      const store = new TokenStore(makeConfig(file))

      expect(() => store.read()).toThrow(/Tokens file not found/)
    })

    it('throws error when file contains invalid JSON', () => {
      const file = tempFile()
      writeFileSync(file, '{ invalid json', { mode: 0o600 })

      const store = new TokenStore(makeConfig(file))

      expect(() => store.read()).toThrow(
        expect.objectContaining({
          name: 'AppError',
          code: 'INTERNAL',
        }),
      )
    })

    it('returns data even with wrong format (no validation in implementation)', () => {
      const file = tempFile()
      const invalidData = { invalidFormat: true }
      writeFileSync(file, JSON.stringify(invalidData), { mode: 0o600 })

      const store = new TokenStore(makeConfig(file))

      // The actual implementation doesn't validate the token structure
      const result = store.read()
      expect(result).toEqual(invalidData)
    })

    it('returns data even when tokens are missing required fields', () => {
      const file = tempFile()
      const partialData = { idToken: 'only-id' }
      writeFileSync(file, JSON.stringify(partialData), { mode: 0o600 })

      const store = new TokenStore(makeConfig(file))

      // The actual implementation doesn't validate required fields
      const result = store.read()
      expect(result).toEqual(partialData)
    })
  })

  describe('file permissions', () => {
    it('creates parent directories if they do not exist', () => {
      const dir = mkdtempSync(join(tmpdir(), 'tweek-nested-'))
      const nestedFile = join(dir, 'deeply', 'nested', 'tokens.json')
      const store = new TokenStore(makeConfig(nestedFile))

      expect(() => store.write(sampleTokens)).not.toThrow()

      const stats = statSync(nestedFile)
      expect((stats.mode & 0o777)).toBe(0o600)
    })

    it('preserves restrictive permissions on existing file', () => {
      const file = tempFile()
      const store = new TokenStore(makeConfig(file))

      // Write first time
      store.write(sampleTokens)
      let stats = statSync(file)
      expect((stats.mode & 0o777)).toBe(0o600)

      // Write again (overwrite)
      const newTokens: AuthTokens = {
        idToken: 'new-id',
        refreshToken: 'new-refresh',
        expiresAt: FIXED_TIME + 7200_000,
      }
      store.write(newTokens)

      stats = statSync(file)
      expect((stats.mode & 0o777)).toBe(0o600)

      const readTokens = store.read()
      expect(readTokens).toEqual(newTokens)
    })
  })
})
