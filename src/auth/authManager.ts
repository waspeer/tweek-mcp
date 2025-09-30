import type { AppConfig } from '../config/index.js'
import type { Logger } from '../logging/index.js'
import type { AuthTokens } from './types.js'
import { createLogger } from '../logging/index.js'
import { AppError } from './errors.js'
import { IdentityClient } from './identityClient.js'
import { TokenStore } from './tokenStore.js'

export class AuthManager {
  private readonly refreshBufferSec: number
  private readonly tokenStore: TokenStore
  private readonly identityClient: IdentityClient
  private readonly logger: Logger

  private cachedTokens: AuthTokens | null = null

  constructor(config: AppConfig, logger?: Logger) {
    this.refreshBufferSec = config.tokenRefreshBufferSec
    this.tokenStore = new TokenStore(config)
    this.identityClient = new IdentityClient(config)
    this.logger = logger || createLogger('AuthManager')
  }

  initialize(): void {
    const tokens = this.tokenStore.read()
    this.cachedTokens = tokens
    if (this.isExpiringSoon(tokens)) {
      // Best-effort proactive refresh; if it fails, consumer can retry on demand
      this.refresh().catch((err: unknown) => {
        if (err instanceof AppError) {
          this.logger.warn('Proactive token refresh failed', { code: err.code, details: err.details })
        }
        else if (err instanceof Error) {
          this.logger.warn('Proactive token refresh failed', { error: err.name, message: err.message })
        }
        else {
          this.logger.warn('Proactive token refresh failed', { error: String(err) })
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
