import type { AppConfig } from '../config/index.js'
import type { AuthTokens } from './types.js'
import { AppError } from './errors.js'

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
    catch (err: unknown) {
      const isAbort = err instanceof Error && (err.name === 'AbortError' || err.name === 'DOMException')
      clearTimeout(timeoutId)
      throw new AppError(
        'IDENTITY_NETWORK',
        isAbort ? 'Identity sign-in aborted/timeout' : 'Identity sign-in network failure',
        { cause: err },
      )
    }
    finally {
      clearTimeout(timeoutId)
    }

    if (!res.ok) {
      const retryAfterHeader = res.headers.get('retry-after')
      const retryAfterMs = retryAfterHeader != null ? parseRetryAfterMs(retryAfterHeader, Date.now()) : undefined
      if (res.status === 401 || res.status === 403)
        throw new AppError('IDENTITY_UNAUTHORIZED', 'Unauthorized sign-in/refresh', { details: { status: res.status } })
      if (res.status === 429)
        throw new AppError('IDENTITY_RATE_LIMITED', 'Identity service rate limited', { details: { status: res.status, retryAfterMs } })
      const text = await res.text().catch(() => '')
      const cause = text.length > 0 ? new Error(text.slice(0, 200)) : undefined
      throw new AppError('IDENTITY_NETWORK', `Identity sign-in failed (${res.status})`, { details: { status: res.status }, cause })
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
    catch (err: unknown) {
      const isAbort = err instanceof Error && (err.name === 'AbortError' || err.name === 'DOMException')
      clearTimeout(timeoutId)
      throw new AppError(
        'IDENTITY_NETWORK',
        isAbort ? 'Identity refresh aborted/timeout' : 'Identity refresh network failure',
        { cause: err },
      )
    }
    finally {
      clearTimeout(timeoutId)
    }
    if (!res.ok) {
      const retryAfterHeader = res.headers.get('retry-after')
      const retryAfterMs = retryAfterHeader != null ? parseRetryAfterMs(retryAfterHeader, Date.now()) : undefined
      if (res.status === 401 || res.status === 403)
        throw new AppError('IDENTITY_UNAUTHORIZED', 'Unauthorized sign-in/refresh', { details: { status: res.status } })
      if (res.status === 429)
        throw new AppError('IDENTITY_RATE_LIMITED', 'Identity service rate limited', { details: { status: res.status, retryAfterMs } })
      const text = await res.text().catch(() => '')
      const cause = text.length > 0 ? new Error(text.slice(0, 200)) : undefined
      throw new AppError('IDENTITY_NETWORK', `Identity refresh failed (${res.status})`, { details: { status: res.status }, cause })
    }
    const body = (await res.json()) as RefreshResponseDto
    const nowMs = Date.now()
    return {
      idToken: body.idToken,
      expiresAt: nowMs + body.expiresIn * 1000,
    }
  }
}

function parseRetryAfterMs(header: string, nowMs: number): number | undefined {
  const seconds = Number(header)
  if (Number.isFinite(seconds))
    return Math.max(0, Math.floor(seconds * 1000))
  const when = Date.parse(header)
  if (!Number.isNaN(when))
    return Math.max(0, when - nowMs)
  return undefined
}
