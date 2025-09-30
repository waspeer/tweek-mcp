export interface AuthTokens {
  idToken: string
  refreshToken: string
  /**
   * Epoch milliseconds when the idToken expires.
   */
  expiresAt: number
}
