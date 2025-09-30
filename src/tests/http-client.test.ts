import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { HttpClient } from '../http/httpClient.js'
import { HttpError, HttpErrorType } from '../http/types.js'
import type { AppConfig } from '../config/index.js'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('HttpClient', () => {
  let client: HttpClient
  let mockConfig: AppConfig

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    mockConfig = {
      apiBaseUrl: 'https://api.example.com',
      apiKey: 'test-api-key',
      tokensPath: '/tmp/tokens.json',
      requestTimeoutMs: 5000,
      tokenRefreshBufferSec: 120,
      encryptionKey: undefined
    }
    
    client = new HttpClient(mockConfig)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('initializes with app config', () => {
      expect(client).toBeInstanceOf(HttpClient)
    })
  })

  describe('setAuthorizationHeader', () => {
    it('includes authorization header in requests when token is set', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: 'success' })
      }
      mockFetch.mockResolvedValue(mockResponse)
      
      client.setAuthorizationHeader('test-token-123')
      await client.request('/test')
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token-123'
          })
        })
      )
    })

    it('does not include authorization header when no token is set', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: 'success' })
      }
      mockFetch.mockResolvedValue(mockResponse)
      
      await client.request('/test')
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.anything()
          })
        })
      )
    })

    it('updates authorization header when token is changed', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: 'success' })
      }
      mockFetch.mockResolvedValue(mockResponse)
      
      client.setAuthorizationHeader('first-token')
      await client.request('/test1')
      
      client.setAuthorizationHeader('second-token')
      await client.request('/test2')
      
      expect(mockFetch).toHaveBeenNthCalledWith(2,
        'https://api.example.com/test2',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer second-token'
          })
        })
      )
    })
  })

  describe('request method', () => {
    it('makes successful GET request with default headers', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: 'success' })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await client.request('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
            'Content-Type': 'application/json',
            'User-Agent': 'tweek-mcp/1.0.0'
          }),
          body: undefined,
          signal: expect.any(AbortSignal)
        })
      )

      expect(result).toEqual({
        status: 200,
        statusText: 'OK',
        headers: mockResponse.headers,
        data: { data: 'success' }
      })
    })

    it('makes POST request with JSON body', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        statusText: 'Created',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: '123' })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const requestBody = { name: 'Test Item' }
      await client.request('/items', {
        method: 'POST',
        body: requestBody
      })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody)
        })
      )
    })

    it('handles string body', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: async () => 'success'
      }
      mockFetch.mockResolvedValue(mockResponse)

      const requestBody = 'raw string data'
      await client.request('/items', {
        method: 'POST',
        body: requestBody
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: requestBody
        })
      )
    })

    it('merges custom headers with defaults', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: async () => 'success'
      }
      mockFetch.mockResolvedValue(mockResponse)

      await client.request('/test', {
        headers: {
          'Authorization': 'Bearer token123',
          'Custom-Header': 'custom-value'
        }
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token123',
            'Custom-Header': 'custom-value'
          })
        })
      )
    })

    it('handles non-JSON response content', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'plain text response'
      }
      mockFetch.mockResolvedValue(mockResponse)

      const result = await client.request('/text')

      expect(result.data).toBe('plain text response')
    })

    it('throws HttpError for HTTP error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => JSON.stringify({ message: 'Resource not found' })
      }
      mockFetch.mockResolvedValue(mockResponse)

      await expect(client.request('/missing')).rejects.toThrow(HttpError)
      
      try {
        await client.request('/missing')
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError)
        expect((error as HttpError).type).toBe(HttpErrorType.NOT_FOUND)
        expect((error as HttpError).status).toBe(404)
      }
    })

    it('handles request timeout', async () => {
      // Mock fetch to never resolve
      mockFetch.mockImplementation(() => new Promise(() => {}))

      const promise = client.request('/slow', { timeout: 1000 })

      // Advance time to trigger timeout
      vi.advanceTimersByTime(1100)
      await vi.runOnlyPendingTimersAsync()

      await expect(promise).rejects.toThrow('Request timeout after 1000ms')
    }, 10000)

    it('handles abort errors specifically', async () => {
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      mockFetch.mockRejectedValue(abortError)

      await expect(client.request('/test')).rejects.toThrow('Request timeout')
    })

    it('logs requests with redacted headers', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: async () => 'success'
      }
      mockFetch.mockResolvedValue(mockResponse)

      await client.request('/test', {
        headers: {
          'Authorization': 'Bearer secret-token',
          'x-api-key': 'secret-key',
          'Custom-Header': 'visible-value'
        }
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        'HTTP GET /test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': '[REDACTED]',
            'x-api-key': '[REDACTED]',
            'Custom-Header': 'visible-value'
          })
        })
      )

      consoleSpy.mockRestore()
    })

    it('logs response with duration', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        text: async () => 'success'
      }
      mockFetch.mockResolvedValue(mockResponse)

      await client.request('/test')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/HTTP GET \/test → 200 OK \(\d+ms\)/)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('convenience methods', () => {
    beforeEach(() => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ success: true }),
        text: async () => JSON.stringify({ success: true })
      }
      mockFetch.mockResolvedValue(mockResponse)
    })

    it('get() method calls request with GET', async () => {
      await client.get('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'GET' })
      )
    })

    it('post() method calls request with POST and body', async () => {
      const body = { data: 'test' }
      await client.post('/test', body)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body)
        })
      )
    })

    it('put() method calls request with PUT and body', async () => {
      const body = { data: 'test' }
      await client.put('/test', body)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(body)
        })
      )
    })

    it('patch() method calls request with PATCH and body', async () => {
      const body = { data: 'test' }
      await client.patch('/test', body)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(body)
        })
      )
    })

    it('delete() method calls request with DELETE', async () => {
      await client.delete('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  describe('integration with retry logic', () => {
    it('retries GET requests on 5xx errors', async () => {
      const serverError = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server Error'
      }

      const successResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        json: async () => ({ success: true })
      }

      mockFetch
        .mockResolvedValueOnce(serverError)
        .mockResolvedValueOnce(serverError)
        .mockResolvedValueOnce(successResponse)

      const promise = client.get('/test')
      
      // Fast-forward through retry delays
      await vi.runAllTimersAsync()

      const result = await promise
      expect(result.data).toEqual({ success: true })
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('does not retry POST requests', async () => {
      const serverError = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server Error'
      }

      mockFetch.mockResolvedValue(serverError)

      await expect(client.post('/test', {})).rejects.toThrow(HttpError)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('input validation', () => {
    it('throws error for empty path', async () => {
      await expect(client.request('')).rejects.toThrow('Path must be a non-empty string')
    })

    it('throws error for null path', async () => {
      await expect(client.request(null as any)).rejects.toThrow('Path must be a non-empty string')
    })

    it('throws error for non-string path', async () => {
      await expect(client.request(123 as any)).rejects.toThrow('Path must be a non-empty string')
    })

    it('throws error for non-object options', async () => {
      await expect(client.request('/test', 'invalid' as any)).rejects.toThrow('Options must be an object')
    })
  })
})