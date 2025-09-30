import process from 'node:process'
import { Command } from 'commander'
import { AppError } from '../auth/errors.js'
import { IdentityClient } from '../auth/identityClient.js'
import { TokenStore } from '../auth/tokenStore.js'
import { loadConfigFromEnv } from '../config/index.js'

export async function main(): Promise<void> {
  const program = new Command()
  program
    .name('tweek-mcp auth import')
    .description('Import an existing refresh token and exchange it for current tokens')
    .requiredOption('--refresh-token <token>', 'Refresh token to import')
    .parse()

  const options = program.opts<{
    refreshToken: string
  }>()

  try {
    const config = loadConfigFromEnv()
    const identityClient = new IdentityClient(config)
    const tokenStore = new TokenStore(config)

    console.log('Importing refresh token and exchanging for new tokens...')
    const { idToken, expiresAt } = await identityClient.refreshIdToken(options.refreshToken)

    const tokens = {
      idToken,
      refreshToken: options.refreshToken,
      expiresAt,
    }

    tokenStore.write(tokens)
    console.log(`✅ Token import successful! Tokens stored at: ${config.tokensPath}`)
  }
  catch (error) {
    if (error instanceof AppError) {
      switch (error.code) {
        case 'IDENTITY_UNAUTHORIZED':
          console.error('❌ Import failed: Invalid or expired refresh token')
          break
        case 'IDENTITY_RATE_LIMITED':
          console.error('❌ Rate limited by Tweek. Please try again later.')
          break
        case 'IDENTITY_NETWORK':
          console.error('❌ Network error during token exchange. Please check your connection.')
          break
        case 'TOKENS_NOT_FOUND':
        case 'TOKENS_FORMAT_UNSUPPORTED':
        case 'TOKENS_PATH_INVALID':
        case 'INTERNAL':
        default:
          console.error(`❌ Import error: ${error.message}`)
      }
    }
    else if (error instanceof Error) {
      console.error(`❌ Error: ${error.message}`)
    }
    else {
      console.error('❌ An unexpected error occurred')
    }
    process.exit(1)
  }
}

// Check if this module is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Explicitly mark as intentionally not awaited to satisfy lint rule
  void main()
}
