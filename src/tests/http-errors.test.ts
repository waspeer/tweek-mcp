import { describe, expect, it } from 'vitest'
import {
  createHttpError,
  isHttpErrorOfType,
  isRetriableError,
  mapHttpStatusToErrorType,
} from '../http/errors.js'
import { HttpError, HttpErrorType } from '../http/types.js'

describe('hTTP error mapping', () => {
  describe('mapHttpStatusToErrorType', () => {
    it('maps 401 and 403 to UNAUTHENTICATED', () => {
      expect(mapHttpStatusToErrorType(401)).toBe(HttpErrorType.UNAUTHENTICATED)
      expect(mapHttpStatusToErrorType(403)).toBe(HttpErrorType.UNAUTHENTICATED)
    })

    it('maps 404 to NOT_FOUND', () => {
      expect(mapHttpStatusToErrorType(404)).toBe(HttpErrorType.NOT_FOUND)
    })

    it('maps 400 to INVALID_ARGUMENT', () => {
      expect(mapHttpStatusToErrorType(400)).toBe(HttpErrorType.INVALID_ARGUMENT)
    })

    it('maps 429 to RESOURCE_EXHAUSTED', () => {
      expect(mapHttpStatusToErrorType(429)).toBe(HttpErrorType.RESOURCE_EXHAUSTED)
    })

    it('maps 5xx errors to UNAVAILABLE', () => {
      expect(mapHttpStatusToErrorType(500)).toBe(HttpErrorType.UNAVAILABLE)
      expect(mapHttpStatusToErrorType(502)).toBe(HttpErrorType.UNAVAILABLE)
      expect(mapHttpStatusToErrorType(503)).toBe(HttpErrorType.UNAVAILABLE)
      expect(mapHttpStatusToErrorType(504)).toBe(HttpErrorType.UNAVAILABLE)
      expect(mapHttpStatusToErrorType(599)).toBe(HttpErrorType.UNAVAILABLE)
    })

    it('maps other status codes to UNKNOWN', () => {
      expect(mapHttpStatusToErrorType(200)).toBe(HttpErrorType.UNKNOWN)
      expect(mapHttpStatusToErrorType(300)).toBe(HttpErrorType.UNKNOWN)
      expect(mapHttpStatusToErrorType(418)).toBe(HttpErrorType.UNKNOWN)
      expect(mapHttpStatusToErrorType(600)).toBe(HttpErrorType.UNKNOWN)
    })
  })

  describe('createHttpError', () => {
    it('creates HttpError from Response with JSON body', async () => {
      const mockResponse = {
        status: 400,
        statusText: 'Bad Request',
        text: async () => JSON.stringify({ message: 'Invalid input', code: 'VALIDATION_ERROR' }),
      } as Response

      const error = await createHttpError(mockResponse)

      expect(error).toBeInstanceOf(HttpError)
      expect(error.type).toBe(HttpErrorType.INVALID_ARGUMENT)
      expect(error.status).toBe(400)
      expect(error.statusText).toBe('Bad Request')
      expect(error.response).toEqual({ message: 'Invalid input', code: 'VALIDATION_ERROR' })
    })

    it('creates HttpError from Response with text body', async () => {
      const mockResponse = {
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Server error occurred',
      } as Response

      const error = await createHttpError(mockResponse)

      expect(error).toBeInstanceOf(HttpError)
      expect(error.type).toBe(HttpErrorType.UNAVAILABLE)
      expect(error.status).toBe(500)
      expect(error.statusText).toBe('Internal Server Error')
      expect(error.response).toEqual({ message: 'Server error occurred' })
    })

    it('creates HttpError with custom message', async () => {
      const mockResponse = {
        status: 404,
        statusText: 'Not Found',
        text: async () => '',
      } as Response

      const error = await createHttpError(mockResponse, 'Resource not found')

      expect(error.message).toBe('Resource not found')
      expect(error.type).toBe(HttpErrorType.NOT_FOUND)
    })

    it('handles empty response body', async () => {
      const mockResponse = {
        status: 401,
        statusText: 'Unauthorized',
        text: async () => '',
      } as Response

      const error = await createHttpError(mockResponse)

      expect(error.type).toBe(HttpErrorType.UNAUTHENTICATED)
      expect(error.response).toBeUndefined()
    })

    it('handles malformed JSON in response', async () => {
      const mockResponse = {
        status: 422,
        statusText: 'Unprocessable Entity',
        text: async () => 'invalid json {',
      } as Response

      const error = await createHttpError(mockResponse)

      expect(error.type).toBe(HttpErrorType.UNKNOWN)
      expect(error.response).toEqual({ message: 'invalid json {' })
    })

    it('handles text/plain error responses', async () => {
      const mockResponse = {
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'Something went wrong on the server',
      } as Response

      const error = await createHttpError(mockResponse)

      expect(error.type).toBe(HttpErrorType.UNAVAILABLE)
      expect(error.response).toEqual({ message: 'Something went wrong on the server' })
    })

    it('handles HTML error responses', async () => {
      const mockResponse = {
        status: 404,
        statusText: 'Not Found',
        text: async () => '<html><body><h1>Page Not Found</h1></body></html>',
      } as Response

      const error = await createHttpError(mockResponse)

      expect(error.type).toBe(HttpErrorType.NOT_FOUND)
      expect(error.response).toEqual({ message: '<html><body><h1>Page Not Found</h1></body></html>' })
    })
  })

  describe('isRetriableError', () => {
    it('returns true for 5xx errors', () => {
      expect(isRetriableError(500)).toBe(true)
      expect(isRetriableError(502)).toBe(true)
      expect(isRetriableError(503)).toBe(true)
      expect(isRetriableError(504)).toBe(true)
      expect(isRetriableError(599)).toBe(true)
    })

    it('returns false for non-5xx errors', () => {
      expect(isRetriableError(200)).toBe(false)
      expect(isRetriableError(400)).toBe(false)
      expect(isRetriableError(401)).toBe(false)
      expect(isRetriableError(404)).toBe(false)
      expect(isRetriableError(429)).toBe(false)
      expect(isRetriableError(600)).toBe(false)
    })
  })

  describe('isHttpErrorOfType', () => {
    it('returns true for matching HttpError type', () => {
      const error = new HttpError(HttpErrorType.NOT_FOUND, 404, 'Not Found')
      expect(isHttpErrorOfType(error, HttpErrorType.NOT_FOUND)).toBe(true)
    })

    it('returns false for non-matching HttpError type', () => {
      const error = new HttpError(HttpErrorType.NOT_FOUND, 404, 'Not Found')
      expect(isHttpErrorOfType(error, HttpErrorType.UNAUTHENTICATED)).toBe(false)
    })

    it('returns false for non-HttpError objects', () => {
      const error = new Error('Regular error')
      expect(isHttpErrorOfType(error, HttpErrorType.NOT_FOUND)).toBe(false)
    })

    it('returns false for non-error values', () => {
      expect(isHttpErrorOfType(null, HttpErrorType.NOT_FOUND)).toBe(false)
      expect(isHttpErrorOfType(undefined, HttpErrorType.NOT_FOUND)).toBe(false)
      expect(isHttpErrorOfType('string', HttpErrorType.NOT_FOUND)).toBe(false)
      expect(isHttpErrorOfType({}, HttpErrorType.NOT_FOUND)).toBe(false)
    })
  })
})
