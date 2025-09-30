import type { AppConfig } from '../config/index.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthManager } from '../auth/authManager.js'
import { IdentityClient } from '../auth/identityClient.js'
import { TokenStore } from '../auth/tokenStore.js'

const FIXED_TIME = new Date('2024-01-01T00:00:00Z').getTime()

function makeConfig(overrides?: Partial<AppConfig>): AppConfig {
  return {
    apiBaseUrl: 'http://api',
    apiKey: 'key',
    tokensPath: '/dev/null',
    requestTimeoutMs: 1000,
    tokenRefreshBufferSec: 60,
    ...overrides,
  }
}

// Test data functions using deterministic time
const validSoon = () => ({ idToken: 'id', refreshToken: 'r', expiresAt: FIXED_TIME + 10_000 })
const expired = () => ({ idToken: 'old', refreshToken: 'r', expiresAt: FIXED_TIME - 1000 })
const validLong = () => ({ idToken: 'still-valid', refreshToken: 'r', expiresAt: FIXED_TIME + 3600_000 })
const refreshResponse = () => ({ idToken: 'new-token', expiresAt: FIXED_TIME + 3600_000 })

describe('authManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_TIME)
    // Silence console warnings in tests
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('initialize loads tokens and proactively refreshes if expiring soon (best effort)', async () => {
    const cfg = makeConfig({ tokenRefreshBufferSec: 120 })
    const read = vi.spyOn(TokenStore.prototype, 'read').mockReturnValue(validSoon())
    const refresh = vi.spyOn(IdentityClient.prototype, 'refreshIdToken').mockResolvedValue(refreshResponse())
    const write = vi.spyOn(TokenStore.prototype, 'write').mockImplementation(() => {})

    const manager = new AuthManager(cfg)
    manager.initialize()

    // Allow queued refresh to run
    await Promise.resolve()

    expect(read).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledWith('r')
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      idToken: 'new-token',
      refreshToken: 'r',
      expiresAt: FIXED_TIME + 3600_000,
    }))
  })

  it('getValidIdToken refreshes when tokens expired', async () => {
    const read = vi.spyOn(TokenStore.prototype, 'read').mockReturnValue(expired())
    const refresh = vi.spyOn(IdentityClient.prototype, 'refreshIdToken').mockResolvedValue(refreshResponse())
    const write = vi.spyOn(TokenStore.prototype, 'write').mockImplementation(() => {})

    const manager = new AuthManager(makeConfig())
    const token = await manager.getValidIdToken()

    expect(token).toBe('new-token')
    expect(read).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledWith('r')
    expect(write).toHaveBeenCalledWith(expect.objectContaining({
      idToken: 'new-token',
      refreshToken: 'r',
    }))
  })

  it('getValidIdToken returns cached token when still valid', async () => {
    const read = vi.spyOn(TokenStore.prototype, 'read').mockReturnValue(validLong())

    const manager = new AuthManager(makeConfig())
    const token = await manager.getValidIdToken()
    expect(token).toBe('still-valid')

    // Subsequent call should not read again and return same token
    const token2 = await manager.getValidIdToken()
    expect(token2).toBe('still-valid')
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('initialize does not refresh when tokens are valid for long time', () => {
    const read = vi.spyOn(TokenStore.prototype, 'read').mockReturnValue(validLong())
    const refresh = vi.spyOn(IdentityClient.prototype, 'refreshIdToken')

    const manager = new AuthManager(makeConfig())
    manager.initialize()

    expect(read).toHaveBeenCalledTimes(1)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('initialize handles refresh failure gracefully', async () => {
    const read = vi.spyOn(TokenStore.prototype, 'read').mockReturnValue(expired())
    const refresh = vi.spyOn(IdentityClient.prototype, 'refreshIdToken').mockRejectedValue(new Error('Network error'))
    const consoleWarn = vi.mocked(console.warn)

    const manager = new AuthManager(makeConfig({ tokenRefreshBufferSec: 120 }))
    manager.initialize()

    // Allow queued refresh to fail by advancing timers and waiting for microtasks
    await vi.runAllTimersAsync()

    expect(read).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledWith('r')
    expect(consoleWarn).toHaveBeenCalled()
    const warnMessage = consoleWarn.mock.calls[0][0] as string
    expect(warnMessage).toContain('Proactive token refresh failed')
    expect(warnMessage).toContain('Network error')
  })

  it('expiry logic works correctly at buffer boundary', () => {
    const bufferSec = 60
    const exactlyAtBuffer = () => ({
      idToken: 'border',
      refreshToken: 'r',
      expiresAt: FIXED_TIME + (bufferSec * 1000),
    })
    const justPastBuffer = () => ({
      idToken: 'safe',
      refreshToken: 'r',
      expiresAt: FIXED_TIME + (bufferSec * 1000) + 1000,
    })

    const _readAtBuffer = vi.spyOn(TokenStore.prototype, 'read').mockReturnValue(exactlyAtBuffer())
    const refreshAtBuffer = vi.spyOn(IdentityClient.prototype, 'refreshIdToken')

    const manager1 = new AuthManager(makeConfig({ tokenRefreshBufferSec: bufferSec }))
    manager1.initialize()

    expect(refreshAtBuffer).toHaveBeenCalled()

    vi.clearAllMocks()

    const _readPastBuffer = vi.spyOn(TokenStore.prototype, 'read').mockReturnValue(justPastBuffer())
    const refreshPastBuffer = vi.spyOn(IdentityClient.prototype, 'refreshIdToken')

    const manager2 = new AuthManager(makeConfig({ tokenRefreshBufferSec: bufferSec }))
    manager2.initialize()

    expect(refreshPastBuffer).not.toHaveBeenCalled()
  })
})
