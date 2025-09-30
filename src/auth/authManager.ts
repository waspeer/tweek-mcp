import type { AppConfig } from '../config/index.js'
import type { AuthTokens } from './types.js'
import { AppError } from './errors.js'
import { IdentityClient } from './identityClient.js'
import { TokenStore } from './tokenStore.js'

export class AuthManager {
  private readonly refreshBufferSec: number
  private readonly tokenStore: TokenStore
  private readonly identityClient: IdentityClient

  private cachedTokens: AuthTokens | null = null

  constructor(config: AppConfig) {
    this.refreshBufferSec = config.tokenRefreshBufferSec
    this.tokenStore = new TokenStore(config)
    this.identityClient = new IdentityClient(config)
  }

  initialize(): void {
    const tokens = this.tokenStore.read()
    this.cachedTokens = tokens
    if (this.isExpiringSoon(tokens)) {
      // Best-effort proactive refresh; if it fails, consumer can retry on demand
      this.refresh().catch((err: unknown) => {
        // best-effort; surface for diagnostics without failing startup
        if (err instanceof AppError) {
          console.warn('[AuthManager] proactive refresh failed', { code: err.code, details: err.details })
        }
        else if (err instanceof Error) {
          console.warn('[AuthManager] proactive refresh failed (unknown error)', { name: err.name, message: err.message })
        }
        else {
          console.warn('[AuthManager] proactive refresh failed (non-error)', { value: String(err) })
        }
      })
    }
  }

  async getValidIdToken(): Promise<string> {
    if (!this.cachedTokens) {
      const tokens = this.tokenStore.read()
      this.cachedTokens = tokens
    }
    if (this.cachedTokens !== null && this.isExpiringSoon(this.cachedTokens)) {
      await this.refresh()
    }
    return this.cachedTokens.idToken
  }

  private async refresh(): Promise<void> {
    if (!this.cachedTokens) {
      const tokens = this.tokenStore.read()
      this.cachedTokens = tokens
    }
    const { refreshToken } = this.cachedTokens
    const updated = await this.identityClient.refreshIdToken(refreshToken)
    const newTokens: AuthTokens = {
      idToken: updated.idToken,
      refreshToken,
      expiresAt: updated.expiresAt,
    }
    this.cachedTokens = newTokens
    this.tokenStore.write(newTokens)
  }

  private isExpiringSoon(tokens: AuthTokens): boolean {
    const nowMs = Date.now()
    const bufferMs = this.refreshBufferSec * 1000
    return tokens.expiresAt <= (nowMs + bufferMs)
  }
}
