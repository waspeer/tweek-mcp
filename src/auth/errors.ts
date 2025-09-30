export type AuthErrorCode
  = 'TOKENS_NOT_FOUND'
    | 'TOKENS_FORMAT_UNSUPPORTED'
    | 'TOKENS_PATH_INVALID'
    | 'IDENTITY_UNAUTHORIZED'
    | 'IDENTITY_RATE_LIMITED'
    | 'IDENTITY_NETWORK'
    | 'INTERNAL'

export interface ErrorDetails {
  status?: number
  retryAfterMs?: number
  path?: string
  entity?: string
  [key: string]: unknown
}

export class AppError extends Error {
  readonly code: AuthErrorCode
  readonly details?: ErrorDetails
  readonly cause?: unknown

  constructor(code: AuthErrorCode, message: string, options?: { details?: ErrorDetails, cause?: unknown }) {
    super(message, options)
    this.name = new.target.name
    this.code = code
    this.details = options?.details
    this.cause = options?.cause
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
