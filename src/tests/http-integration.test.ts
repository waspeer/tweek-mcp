import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { HttpClient } from '../http/httpClient.js'
import { HttpError, HttpErrorType } from '../http/types.js'
import type { AppConfig } from '../config/index.js'

// Mock server responses for integration testing
class MockServer {
  private responses: Array<{ status: number; statusText: string; body: any; headers?: Record<string, string> }> = []
  private callCount = 0

  addResponse(status: number, statusText: string, body: any, headers?: Record<string, string>) {
    this.responses.push({ status, statusText, body, headers })
  }

  reset() {
    this.responses = []
    this.callCount = 0
  }

  getCallCount() {
    return this.callCount
  }

  private createResponse(responseConfig: typeof this.responses[0]) {
    const headers = new Headers(responseConfig.headers || {})
    headers.set('content-type', 'application/json')

    return {
      ok: responseConfig.status >= 200 && responseConfig.status < 300,
      status: responseConfig.status,
      statusText: responseConfig.statusText,
      headers,
      json: async () => responseConfig.body,
      text: async () => JSON.stringify(responseConfig.body)
    }
  }

  mockFetch() {
    return vi.fn().mockImplementation(() => {
      if (this.callCount >= this.responses.length) {
        throw new Error('No more mock responses available')
      }
      
      const response = this.createResponse(this.responses[this.callCount])
      this.callCount++
      return Promise.resolve(response)
    })
  }
}

describe('HTTP Integration Tests', () => {
  let client: HttpClient
  let mockConfig: AppConfig
  let mockServer: MockServer
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    mockServer = new MockServer()
    
    mockConfig = {
      apiBaseUrl: 'https://api.tweek.so',
      apiKey: 'test-api-key',
      tokensPath: '/tmp/tokens.json',
      requestTimeoutMs: 5000,
      tokenRefreshBufferSec: 120,
      encryptionKey: undefined
    }
    
    client = new HttpClient(mockConfig)
    
    vi.useFakeTimers()
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('successful API calls', () => {
    it('handles full calendar list request cycle', async () => {
      const calendarData = {
        calendars: [
          { id: '1', name: 'Work', role: 'ROLE_OWNER' },
          { id: '2', name: 'Personal', role: 'ROLE_EDITOR' }
        ]
      }

      mockServer.addResponse(200, 'OK', calendarData)
      global.fetch = mockServer.mockFetch()

      const result = await client.get('/calendars')

      expect(result.status).toBe(200)
      expect(result.data).toEqual(calendarData)
      expect(mockServer.getCallCount()).toBe(1)
    })

    it('handles task creation with custom headers', async () => {
      const taskRequest = {
        title: 'New Task',
        calendarId: 'cal-123',
        date: '2024-01-15'
      }

      const taskResponse = {
        id: 'task-456',
        ...taskRequest,
        createdAt: '2024-01-01T12:00:00Z'
      }

      mockServer.addResponse(201, 'Created', taskResponse)
      global.fetch = mockServer.mockFetch()

      const result = await client.post('/tasks', taskRequest, {
        headers: {
          'Authorization': 'Bearer id-token-123',
          'X-Client-Version': '1.0.0'
        }
      })

      expect(result.status).toBe(201)
      expect(result.data).toEqual(taskResponse)
    })

    it('handles paginated task list with query parameters', async () => {
      const taskListResponse = {
        pageSize: 50,
        nextDocId: 'next-page-token',
        data: [
          { id: 'task-1', title: 'First Task' },
          { id: 'task-2', title: 'Second Task' }
        ]
      }

      mockServer.addResponse(200, 'OK', taskListResponse)
      global.fetch = mockServer.mockFetch()

      // Note: Query parameters would be handled by the caller
      const result = await client.get('/tasks?calendarId=cal-123&pageSize=50')

      expect(result.data).toEqual(taskListResponse)
      expect(result.data.data).toHaveLength(2)
      expect(result.data.nextDocId).toBe('next-page-token')
    })
  })

  describe('error handling and recovery', () => {
    it('properly maps and throws authentication errors', async () => {
      const errorBody = { message: 'Invalid token', code: 'AUTH_FAILED' }
      mockServer.addResponse(401, 'Unauthorized', errorBody)
      global.fetch = mockServer.mockFetch()

      try {
        await client.get('/calendars', {
          headers: { 'Authorization': 'Bearer invalid-token' }
        })
        expect.fail('Should have thrown HttpError')
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError)
        expect((error as HttpError).type).toBe(HttpErrorType.UNAUTHENTICATED)
        expect((error as HttpError).status).toBe(401)
        expect((error as HttpError).response).toEqual(errorBody)
      }
    })

    it('properly maps validation errors', async () => {
      const errorBody = { 
        message: 'Validation failed',
        errors: ['calendarId is required', 'date must be valid ISO format']
      }
      mockServer.addResponse(400, 'Bad Request', errorBody)
      global.fetch = mockServer.mockFetch()

      try {
        await client.post('/tasks', { title: 'Invalid Task' })
        expect.fail('Should have thrown HttpError')
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError)
        expect((error as HttpError).type).toBe(HttpErrorType.INVALID_ARGUMENT)
        expect((error as HttpError).status).toBe(400)
        expect((error as HttpError).response.errors).toHaveLength(2)
      }
    })

    it('handles not found errors for specific resources', async () => {
      const errorBody = { message: 'Task not found', resource: 'task', id: 'missing-task' }
      mockServer.addResponse(404, 'Not Found', errorBody)
      global.fetch = mockServer.mockFetch()

      try {
        await client.get('/tasks/missing-task')
        expect.fail('Should have thrown HttpError')
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError)
        expect((error as HttpError).type).toBe(HttpErrorType.NOT_FOUND)
        expect((error as HttpError).response.id).toBe('missing-task')
      }
    })

    it('handles rate limiting with proper error type', async () => {
      const errorBody = { 
        message: 'Rate limit exceeded',
        retryAfter: 60,
        limit: 100,
        remaining: 0
      }
      mockServer.addResponse(429, 'Too Many Requests', errorBody)
      global.fetch = mockServer.mockFetch()

      try {
        await client.get('/tasks')
        expect.fail('Should have thrown HttpError')
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError)
        expect((error as HttpError).type).toBe(HttpErrorType.RESOURCE_EXHAUSTED)
        expect((error as HttpError).response.retryAfter).toBe(60)
      }
    })
  })

  describe('retry logic integration', () => {
    it('successfully retries GET request after server errors', async () => {
      // First two requests fail with 503, third succeeds
      mockServer.addResponse(503, 'Service Unavailable', { message: 'Server temporarily unavailable' })
      mockServer.addResponse(503, 'Service Unavailable', { message: 'Server temporarily unavailable' })
      mockServer.addResponse(200, 'OK', { calendars: [{ id: '1', name: 'Test' }] })
      
      global.fetch = mockServer.mockFetch()

      const promise = client.get('/calendars')
      
      // Fast-forward through retry delays
      await vi.runAllTimersAsync()

      const result = await promise
      expect(result.status).toBe(200)
      expect(result.data.calendars).toHaveLength(1)
      expect(mockServer.getCallCount()).toBe(3)
    })

    it('successfully retries DELETE request after server errors', async () => {
      // First request fails with 502, second succeeds
      mockServer.addResponse(502, 'Bad Gateway', { message: 'Gateway error' })
      mockServer.addResponse(200, 'OK', { success: true, deletedId: 'task-123' })
      
      global.fetch = mockServer.mockFetch()

      const promise = client.delete('/tasks/task-123')
      
      await vi.runAllTimersAsync()

      const result = await promise
      expect(result.status).toBe(200)
      expect(result.data.success).toBe(true)
      expect(mockServer.getCallCount()).toBe(2)
    })

    it('does not retry POST requests even on server errors', async () => {
      mockServer.addResponse(500, 'Internal Server Error', { message: 'Server error' })
      global.fetch = mockServer.mockFetch()

      try {
        await client.post('/tasks', { title: 'New Task' })
        expect.fail('Should have thrown HttpError')
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError)
        expect((error as HttpError).type).toBe(HttpErrorType.UNAVAILABLE)
        expect(mockServer.getCallCount()).toBe(1) // No retry
      }
    })

    it('gives up after maximum retry attempts', async () => {
      // All requests fail with 500
      mockServer.addResponse(500, 'Internal Server Error', { message: 'Persistent error' })
      mockServer.addResponse(500, 'Internal Server Error', { message: 'Persistent error' })
      mockServer.addResponse(500, 'Internal Server Error', { message: 'Persistent error' })
      
      global.fetch = mockServer.mockFetch()

      const promise = client.get('/calendars')
      
      await vi.runAllTimersAsync()

      try {
        await promise
        expect.fail('Should have thrown HttpError')
      } catch (error) {
        expect(error).toBeInstanceOf(HttpError)
        expect((error as HttpError).type).toBe(HttpErrorType.UNAVAILABLE)
        expect(mockServer.getCallCount()).toBe(3) // Default max attempts
      }
    })
  })

  describe('end-to-end request lifecycle', () => {
    it('completes full task CRUD cycle with proper headers and error handling', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // 1. Create task
      const createTaskRequest = {
        title: 'Integration Test Task',
        calendarId: 'cal-integration',
        date: '2024-01-15'
      }
      
      const createTaskResponse = {
        id: 'task-integration-123',
        ...createTaskRequest,
        createdAt: '2024-01-01T12:00:00Z'
      }
      
      mockServer.addResponse(201, 'Created', createTaskResponse)

      // 2. Get task
      mockServer.addResponse(200, 'OK', createTaskResponse)

      // 3. Update task
      const updateTaskRequest = { title: 'Updated Integration Test Task' }
      const updateTaskResponse = { ...createTaskResponse, ...updateTaskRequest }
      mockServer.addResponse(200, 'OK', updateTaskResponse)

      // 4. Delete task
      mockServer.addResponse(200, 'OK', { success: true, deletedId: 'task-integration-123' })

      global.fetch = mockServer.mockFetch()

      // Execute the CRUD cycle
      const authHeaders = { 'Authorization': 'Bearer integration-token' }

      // Create
      const createResult = await client.post('/tasks', createTaskRequest, { headers: authHeaders })
      expect(createResult.status).toBe(201)
      expect(createResult.data.id).toBe('task-integration-123')

      // Read
      const getResult = await client.get(`/tasks/${createResult.data.id}`, { headers: authHeaders })
      expect(getResult.status).toBe(200)
      expect(getResult.data.title).toBe(createTaskRequest.title)

      // Update
      const updateResult = await client.patch(`/tasks/${createResult.data.id}`, updateTaskRequest, { headers: authHeaders })
      expect(updateResult.status).toBe(200)
      expect(updateResult.data.title).toBe('Updated Integration Test Task')

      // Delete
      const deleteResult = await client.delete(`/tasks/${createResult.data.id}`, { headers: authHeaders })
      expect(deleteResult.status).toBe(200)
      expect(deleteResult.data.success).toBe(true)

      // Verify all requests were made
      expect(mockServer.getCallCount()).toBe(4)

      // Verify logging includes request/response pairs with redacted auth headers
      expect(consoleSpy).toHaveBeenCalledWith(
        'HTTP POST /tasks',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': '[REDACTED]'
          })
        })
      )

      consoleSpy.mockRestore()
    })
  })
})