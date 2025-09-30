import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadConfigFromEnv } from '../config/index.js'

function baseEnv(): NodeJS.ProcessEnv {
  return {
    TWEEK_API_KEY: 'test-key',
  } as unknown as NodeJS.ProcessEnv
}

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'tweek-config-'))
}

describe('loadConfigFromEnv', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses defaults and expands tokens path', () => {
    const dir = tempDir()
    const env = {
      ...baseEnv(),
      TWEEK_TOKENS_PATH: join(dir, 'tokens.json'),
    }
    const cfg = loadConfigFromEnv(env)

    expect(cfg.apiBaseUrl).toBe('https://tweek.so/api')
    expect(cfg.apiKey).toBe('test-key')
    expect(cfg.tokensPath.endsWith('/tokens.json')).toBe(true)
    expect(dirname(cfg.tokensPath)).toBe(dir)
    expect(cfg.requestTimeoutMs).toBe(10000)
    expect(cfg.tokenRefreshBufferSec).toBe(120)
    expect(cfg.encryptionKey).toBeUndefined()
  })

  it('throws when TWEEK_API_KEY missing', () => {
    const env = {} as NodeJS.ProcessEnv
    expect(() => loadConfigFromEnv(env)).toThrow(/Missing TWEEK_API_KEY environment variable/)
  })

  it('throws when TWEEK_API_KEY is empty string', () => {
    const env = { TWEEK_API_KEY: '' } as NodeJS.ProcessEnv
    expect(() => loadConfigFromEnv(env)).toThrow(/Missing TWEEK_API_KEY environment variable/)
  })

  it('throws when TWEEK_API_KEY is only whitespace', () => {
    const env = { TWEEK_API_KEY: '   \t\n  ' } as NodeJS.ProcessEnv
    expect(() => loadConfigFromEnv(env)).toThrow(/Missing TWEEK_API_KEY environment variable/)
  })

  it('parses numeric envs and trims encryption key', () => {
    const dir = tempDir()
    const env = {
      ...baseEnv(),
      TWEEK_REQUEST_TIMEOUT_MS: '2500',
      TWEEK_TOKEN_REFRESH_BUFFER_SEC: '60',
      TWEEK_ENCRYPTION_KEY: '  secret  ',
      TWEEK_TOKENS_PATH: join(dir, 'tokens.json'),
    }
    const cfg = loadConfigFromEnv(env)
    expect(cfg.requestTimeoutMs).toBe(2500)
    expect(cfg.tokenRefreshBufferSec).toBe(60)
    expect(cfg.encryptionKey).toBe('secret')
  })

  it('uses defaults for invalid numeric values', () => {
    const env = {
      ...baseEnv(),
      TWEEK_REQUEST_TIMEOUT_MS: 'not-a-number',
      TWEEK_TOKEN_REFRESH_BUFFER_SEC: '-100',
    }
    const cfg = loadConfigFromEnv(env)

    expect(cfg.requestTimeoutMs).toBe(10000) // default
    expect(cfg.tokenRefreshBufferSec).toBe(120) // default
  })

  it('handles zero values correctly', () => {
    const env = {
      ...baseEnv(),
      TWEEK_REQUEST_TIMEOUT_MS: '0',
      TWEEK_TOKEN_REFRESH_BUFFER_SEC: '0',
    }
    const cfg = loadConfigFromEnv(env)

    expect(cfg.requestTimeoutMs).toBe(0)
    expect(cfg.tokenRefreshBufferSec).toBe(0)
  })

  it('ignores empty encryption key', () => {
    const env = {
      ...baseEnv(),
      TWEEK_ENCRYPTION_KEY: '',
    }
    const cfg = loadConfigFromEnv(env)

    expect(cfg.encryptionKey).toBeUndefined()
  })

  it('ignores whitespace-only encryption key', () => {
    const env = {
      ...baseEnv(),
      TWEEK_ENCRYPTION_KEY: '   \t\n  ',
    }
    const cfg = loadConfigFromEnv(env)

    expect(cfg.encryptionKey).toBeUndefined()
  })

  it('expands home directory path correctly', () => {
    const env = {
      ...baseEnv(),
      TWEEK_TOKENS_PATH: '~/.config/tweek/tokens.json',
    }
    const cfg = loadConfigFromEnv(env)

    expect(cfg.tokensPath).toMatch(/^\/.+\.config\/tweek\/tokens\.json$/)
    expect(cfg.tokensPath).not.toContain('~')
  })

  it('handles custom API base URL', () => {
    const env = {
      ...baseEnv(),
      TWEEK_API_BASE: 'https://custom-api.example.com',
    }
    const cfg = loadConfigFromEnv(env)

    expect(cfg.apiBaseUrl).toBe('https://custom-api.example.com')
  })
})
