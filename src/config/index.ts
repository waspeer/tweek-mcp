import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import process from 'node:process'

export interface AppConfig {
  apiBaseUrl: string
  apiKey: string
  tokensPath: string
  requestTimeoutMs: number
  tokenRefreshBufferSec: number
  encryptionKey?: string
}

function expandHomePath(inputPath: string): string {
  if (inputPath === '~')
    return homedir()
  if (inputPath.startsWith('~/')) {
    return join(homedir(), inputPath.slice(2))
  }
  return inputPath
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const num = typeof value === 'string' ? Number(value) : Number(value)
  if (!Number.isFinite(num) || num < 0)
    return fallback
  return Math.floor(num)
}

export function loadConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const apiBaseUrl = env.TWEEK_API_BASE ?? 'https://tweek.so/api/v1'
  const apiKey = env.TWEEK_API_KEY ?? ''

  if (apiKey.trim().length === 0) {
    throw new Error('Missing TWEEK_API_KEY environment variable')
  }

  const defaultTokensPath = '~/.config/tweek/tokens.json'
  const tokensPathRaw = env.TWEEK_TOKENS_PATH ?? defaultTokensPath
  const tokensPathExpanded = expandHomePath(tokensPathRaw)

  // Ensure directory exists (cross-platform)
  const absoluteTokensPath = isAbsolute(tokensPathExpanded)
    ? tokensPathExpanded
    : resolve(process.cwd(), tokensPathExpanded)
  mkdirSync(dirname(absoluteTokensPath), { recursive: true })

  const requestTimeoutMs = parsePositiveInt(env.TWEEK_REQUEST_TIMEOUT_MS ?? 10000, 10000)
  const tokenRefreshBufferSec = parsePositiveInt(env.TWEEK_TOKEN_REFRESH_BUFFER_SEC ?? 120, 120)
  const encryptionKeyRaw = env.TWEEK_ENCRYPTION_KEY
  const encryptionKey = typeof encryptionKeyRaw === 'string'
    && encryptionKeyRaw.trim().length > 0
    ? encryptionKeyRaw.trim()
    : undefined

  return {
    apiBaseUrl,
    apiKey,
    tokensPath: absoluteTokensPath,
    requestTimeoutMs,
    tokenRefreshBufferSec,
    encryptionKey,
  }
}
