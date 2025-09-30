import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogger } from '../logging/index.js'

describe('logging', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('createLogger', () => {
    it('logs info messages with timestamp and level', () => {
      const logger = createLogger()
      logger.info('Test message')

      expect(consoleLogSpy).toHaveBeenCalledOnce()
      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string
      expect(loggedMessage).toMatch(/\[.*\] \[INFO\] Test message/)
    })

    it('logs warn messages with timestamp and level', () => {
      const logger = createLogger()
      logger.warn('Warning message')

      expect(consoleWarnSpy).toHaveBeenCalledOnce()
      const loggedMessage = consoleWarnSpy.mock.calls[0][0] as string
      expect(loggedMessage).toMatch(/\[.*\] \[WARN\] Warning message/)
    })

    it('logs error messages with timestamp and level', () => {
      const logger = createLogger()
      logger.error('Error message')

      expect(consoleErrorSpy).toHaveBeenCalledOnce()
      const loggedMessage = consoleErrorSpy.mock.calls[0][0] as string
      expect(loggedMessage).toMatch(/\[.*\] \[ERROR\] Error message/)
    })

    it('includes logger name in messages when provided', () => {
      const logger = createLogger('TestModule')
      logger.info('Test message')

      expect(consoleLogSpy).toHaveBeenCalledOnce()
      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string
      expect(loggedMessage).toContain('[TestModule] Test message')
    })

    it('log() method is an alias for info()', () => {
      const logger = createLogger()
      logger.log('Test message')

      expect(consoleLogSpy).toHaveBeenCalledOnce()
      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string
      expect(loggedMessage).toMatch(/\[INFO\]/)
    })
  })

  describe('sensitive data redaction', () => {
    it('redacts authorization header', () => {
      const logger = createLogger()
      logger.info('Request sent', {
        headers: {
          'authorization': 'Bearer secret-token',
          'content-type': 'application/json',
        },
      })

      expect(consoleLogSpy).toHaveBeenCalledOnce()
      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string
      expect(loggedMessage).toContain('[REDACTED]')
      expect(loggedMessage).not.toContain('secret-token')
      expect(loggedMessage).toContain('application/json')
    })

    it('redacts x-api-key header', () => {
      const logger = createLogger()
      logger.info('Request sent', {
        headers: {
          'x-api-key': 'api-key-secret',
        },
      })

      expect(consoleLogSpy).toHaveBeenCalledOnce()
      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string
      expect(loggedMessage).toContain('[REDACTED]')
      expect(loggedMessage).not.toContain('api-key-secret')
    })

    it('redacts cookie header', () => {
      const logger = createLogger()
      logger.info('Request sent', {
        headers: {
          cookie: 'session=abc123; token=xyz789',
        },
      })

      expect(consoleLogSpy).toHaveBeenCalledOnce()
      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string
      expect(loggedMessage).toContain('[REDACTED]')
      expect(loggedMessage).not.toContain('abc123')
      expect(loggedMessage).not.toContain('xyz789')
    })

    it('redacts x-auth-token header', () => {
      const logger = createLogger()
      logger.info('Request sent', {
        headers: {
          'x-auth-token': 'auth-token-secret',
        },
      })

      expect(consoleLogSpy).toHaveBeenCalledOnce()
      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string
      expect(loggedMessage).toContain('[REDACTED]')
      expect(loggedMessage).not.toContain('auth-token-secret')
    })

    it('redacts password field', () => {
      const logger = createLogger()
      logger.info('User login', {
        email: 'user@example.com',
        password: 'my-secret-password',
      })

      expect(consoleLogSpy).toHaveBeenCalledOnce()
      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string
      expect(loggedMessage).toContain('user@example.com')
      expect(loggedMessage).toContain('[REDACTED]')
      expect(loggedMessage).not.toContain('my-secret-password')
    })

    it('redacts token field', () => {
      const logger = createLogger()
      logger.info('Token refresh', {
        token: 'refresh-token-secret',
        expiresAt: 1234567890,
      })

      expect(consoleLogSpy).toHaveBeenCalledOnce()
      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string
      expect(loggedMessage).toContain('[REDACTED]')
      expect(loggedMessage).toContain('1234567890')
      expect(loggedMessage).not.toContain('refresh-token-secret')
    })

    it('redacts apikey and api_key fields', () => {
      const logger = createLogger()
      logger.info('API request', {
        apikey: 'key-123',
        api_key: 'key-456',
        requestId: 'req-789',
      })

      expect(consoleLogSpy).toHaveBeenCalledOnce()
      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string
      expect(loggedMessage).toContain('[REDACTED]')
      expect(loggedMessage).toContain('req-789')
      expect(loggedMessage).not.toContain('key-123')
      expect(loggedMessage).not.toContain('key-456')
    })

    it('redacts secret field', () => {
      const logger = createLogger()
      logger.info('Config loaded', {
        secret: 'very-secret-value',
        enabled: true,
      })

      expect(consoleLogSpy).toHaveBeenCalledOnce()
      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string
      expect(loggedMessage).toContain('[REDACTED]')
      expect(loggedMessage).toContain('true')
      expect(loggedMessage).not.toContain('very-secret-value')
    })

    it('redacts nested sensitive fields', () => {
      const logger = createLogger()
      logger.info('Complex object', {
        request: {
          headers: {
            authorization: 'Bearer nested-token',
          },
        },
        user: {
          email: 'user@example.com',
          password: 'nested-password',
        },
      })

      expect(consoleLogSpy).toHaveBeenCalledOnce()
      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string
      expect(loggedMessage).toContain('[REDACTED]')
      expect(loggedMessage).toContain('user@example.com')
      expect(loggedMessage).not.toContain('nested-token')
      expect(loggedMessage).not.toContain('nested-password')
    })

    it('redacts sensitive fields in arrays', () => {
      const logger = createLogger()
      logger.info('Batch request', {
        items: [
          { id: 1, token: 'token-1' },
          { id: 2, token: 'token-2' },
        ],
      })

      expect(consoleLogSpy).toHaveBeenCalledOnce()
      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string
      expect(loggedMessage).toContain('[REDACTED]')
      expect(loggedMessage).not.toContain('token-1')
      expect(loggedMessage).not.toContain('token-2')
    })

    it('handles case-insensitive sensitive field matching', () => {
      const logger = createLogger()
      logger.info('Headers', {
        headers: {
          'Authorization': 'Bearer caps-token',
          'X-API-KEY': 'caps-api-key',
          'COOKIE': 'caps-cookie',
        },
      })

      expect(consoleLogSpy).toHaveBeenCalledOnce()
      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string
      expect(loggedMessage).toContain('[REDACTED]')
      expect(loggedMessage).not.toContain('caps-token')
      expect(loggedMessage).not.toContain('caps-api-key')
      expect(loggedMessage).not.toContain('caps-cookie')
    })

    it('preserves non-sensitive data', () => {
      const logger = createLogger()
      logger.info('Request info', {
        method: 'GET',
        path: '/api/tasks',
        status: 200,
        duration: 123,
      })

      expect(consoleLogSpy).toHaveBeenCalledOnce()
      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string
      expect(loggedMessage).toContain('GET')
      expect(loggedMessage).toContain('/api/tasks')
      expect(loggedMessage).toContain('200')
      expect(loggedMessage).toContain('123')
      expect(loggedMessage).not.toContain('[REDACTED]')
    })
  })

  describe('metadata formatting', () => {
    it('includes metadata as JSON when provided', () => {
      const logger = createLogger()
      logger.info('Test message', { key: 'value', count: 42 })

      expect(consoleLogSpy).toHaveBeenCalledOnce()
      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string
      expect(loggedMessage).toContain('"key":"value"')
      expect(loggedMessage).toContain('"count":42')
    })

    it('omits metadata JSON when not provided', () => {
      const logger = createLogger()
      logger.info('Test message')

      expect(consoleLogSpy).toHaveBeenCalledOnce()
      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string
      expect(loggedMessage).not.toContain('{')
      expect(loggedMessage).toMatch(/\[INFO\] Test message$/)
    })

    it('omits metadata JSON when empty object provided', () => {
      const logger = createLogger()
      logger.info('Test message', {})

      expect(consoleLogSpy).toHaveBeenCalledOnce()
      const loggedMessage = consoleLogSpy.mock.calls[0][0] as string
      expect(loggedMessage).not.toContain('{')
    })
  })
})
