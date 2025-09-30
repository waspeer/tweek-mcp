/**
 * Centralized structured logging with automatic sensitive data redaction
 */

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogMetadata {
  [key: string]: unknown
}

export interface Logger {
  info: (message: string, meta?: LogMetadata) => void
  warn: (message: string, meta?: LogMetadata) => void
  error: (message: string, meta?: LogMetadata) => void
  log: (message: string, meta?: LogMetadata) => void
}

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'x-api-key',
  'cookie',
  'x-auth-token',
])

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'apikey',
  'api_key',
  'secret',
  'authorization',
])

function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase()
  return SENSITIVE_KEYS.has(lowerKey) || SENSITIVE_HEADERS.has(lowerKey)
}

function redactSensitiveData(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(item => redactSensitiveData(item))
  }

  if (typeof value === 'object') {
    const redacted: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value)) {
      if (isSensitiveKey(key)) {
        redacted[key] = '[REDACTED]'
      }
      else {
        redacted[key] = redactSensitiveData(val)
      }
    }
    return redacted
  }

  return value
}

function formatLogMessage(level: LogLevel, message: string, meta?: LogMetadata): string {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`

  if (!meta || Object.keys(meta).length === 0) {
    return `${prefix} ${message}`
  }

  const redactedMeta = redactSensitiveData(meta)
  return `${prefix} ${message} ${JSON.stringify(redactedMeta)}`
}

export function createLogger(name?: string): Logger {
  const logPrefix = (name !== undefined && name !== '') ? `[${name}] ` : ''

  return {
    info(message: string, meta?: LogMetadata) {
      const formatted = formatLogMessage('info', logPrefix + message, meta)
      // eslint-disable-next-line no-console
      console.log(formatted)
    },

    warn(message: string, meta?: LogMetadata) {
      const formatted = formatLogMessage('warn', logPrefix + message, meta)
      console.warn(formatted)
    },

    error(message: string, meta?: LogMetadata) {
      const formatted = formatLogMessage('error', logPrefix + message, meta)
      console.error(formatted)
    },

    log(message: string, meta?: LogMetadata) {
      this.info(message, meta)
    },
  }
}

export const defaultLogger = createLogger()
