export interface AuthTokens {
  idToken: string
  refreshToken: string
  /**
   * Epoch milliseconds when the idToken expires.
   */
  expiresAt: number
}

export class TokensNotFoundError extends Error {
  constructor(message = 'Tokens file not found') {
    super(message)
    this.name = 'TokensNotFoundError'
  }
}
