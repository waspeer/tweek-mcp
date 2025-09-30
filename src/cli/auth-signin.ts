import process from 'node:process'
import { createInterface } from 'node:readline'
import { Command } from 'commander'
import { AppError } from '../auth/errors.js'
import { IdentityClient } from '../auth/identityClient.js'
import { TokenStore } from '../auth/tokenStore.js'
import { loadConfigFromEnv } from '../config/index.js'

function createReadlineInterface() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

async function promptHiddenPassword(rl: ReturnType<typeof createReadlineInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    // Disable echo for password input
    const originalWrite = process.stdout.write.bind(process.stdout)
    let isPrompting = false

    process.stdout.write = function (chunk: any, encoding?: any, cb?: any) {
      if (isPrompting && typeof chunk === 'string' && chunk !== question) {
        return true // Suppress output during password input
      }

      // eslint-disable-next-line ts/no-unsafe-argument
      return originalWrite(chunk, encoding, cb)
    }

    rl.question(question, (answer) => {
      isPrompting = false
      process.stdout.write = originalWrite
      process.stdout.write('\n') // Add newline after hidden input
      resolve(answer)
    })

    isPrompting = true
  })
}

async function promptForCredentials(): Promise<{ email: string, password: string }> {
  const rl = createReadlineInterface()

  try {
    const email = await new Promise<string>((resolve) => {
      rl.question('Enter your Tweek email: ', resolve)
    })

    if (!email.trim()) {
      throw new Error('Email cannot be empty')
    }

    const password = await promptHiddenPassword(rl, 'Enter your Tweek password: ')

    if (!password.trim()) {
      throw new Error('Password cannot be empty')
    }

    return { email: email.trim(), password }
  }
  finally {
    rl.close()
  }
}

async function readPasswordFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.on('data', (chunk) => {
      data += chunk.toString()
    })
    process.stdin.on('end', () => {
      resolve(data.trim())
    })
    process.stdin.on('error', reject)
  })
}

export async function main(): Promise<void> {
  const program = new Command()
  program
    .name('tweek-mcp auth signin')
    .description('Authenticate with Tweek and store tokens')
    .option('--email <email>', 'Email address for non-interactive mode')
    .option('--password-stdin', 'Read password from stdin for non-interactive mode')
    .parse()

  const options = program.opts<{
    email?: string
    passwordStdin?: boolean
  }>()

  try {
    const config = loadConfigFromEnv()
    const identityClient = new IdentityClient(config)
    const tokenStore = new TokenStore(config)

    let email: string
    let password: string

    if (Boolean(options.email) && Boolean(options.passwordStdin)) {
      // Non-interactive mode
      email = options.email!
      password = await readPasswordFromStdin()
    }
    else if (Boolean(options.email) || Boolean(options.passwordStdin)) {
      // Error: both options must be provided together
      console.error('Error: --email and --password-stdin must be used together for non-interactive mode')
      process.exit(1)
    }
    else {
      // Interactive mode
      const credentials = await promptForCredentials()
      email = credentials.email
      password = credentials.password
    }

    console.log('Authenticating with Tweek...')
    const tokens = await identityClient.signInWithEmailPassword(email, password)

    tokenStore.write(tokens)
    console.log(`✅ Authentication successful! Tokens stored at: ${config.tokensPath}`)
  }
  catch (error) {
    if (error instanceof AppError) {
      switch (error.code) {
        case 'IDENTITY_UNAUTHORIZED':
          console.error('❌ Authentication failed: Invalid email or password')
          break
        case 'IDENTITY_RATE_LIMITED':
          console.error('❌ Rate limited by Tweek. Please try again later.')
          break
        case 'IDENTITY_NETWORK':
          console.error('❌ Network error during authentication. Please check your connection.')
          break
        case 'TOKENS_NOT_FOUND':
        case 'TOKENS_FORMAT_UNSUPPORTED':
        case 'TOKENS_PATH_INVALID':
        case 'INTERNAL':
        default:
          console.error(`❌ Authentication error: ${error.message}`)
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
