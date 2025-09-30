import type { AppConfig } from '../config/index.js'
import type { AuthTokens } from './types.js'

interface SignInResponseDto {
  idToken: string
  refreshToken: string
  expiresIn: number // seconds
}

interface RefreshResponseDto {
  idToken: string
  expiresIn: number // seconds
}

export class IdentityClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly requestTimeoutMs: number

  constructor(config: AppConfig) {
    this.baseUrl = `${config.apiBaseUrl}/identity`
    this.apiKey = config.apiKey
    this.requestTimeoutMs = config.requestTimeoutMs
  }

  async signInWithEmailPassword(email: string, password: string): Promise<AuthTokens> {
    const url = `${this.baseUrl}/sign-in`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs)
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      })
    }
    finally {
      clearTimeout(timeoutId)
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Identity sign-in failed with status ${res.status}: ${text.slice(0, 200)}`)
    }
    const body = (await res.json()) as SignInResponseDto
    const nowMs = Date.now()
    return {
      idToken: body.idToken,
      refreshToken: body.refreshToken,
      expiresAt: nowMs + body.expiresIn * 1000,
    }
  }

  async refreshIdToken(refreshToken: string): Promise<Pick<AuthTokens, 'idToken' | 'expiresAt'>> {
    const url = `${this.baseUrl}/refresh`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeoutMs)
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
      })
    }
    finally {
      clearTimeout(timeoutId)
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Identity refresh failed with status ${res.status}: ${text.slice(0, 200)}`)
    }
    const body = (await res.json()) as RefreshResponseDto
    const nowMs = Date.now()
    return {
      idToken: body.idToken,
      expiresAt: nowMs + body.expiresIn * 1000,
    }
  }
}
