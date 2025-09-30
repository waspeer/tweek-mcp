/**
 * TweekClient - Typed client for Tweek API endpoints
 */

import type { AuthManager } from '../auth/authManager.js'
import type { AppConfig } from '../config/index.js'
import type {
  CalendarListResponse,
  CreateTaskRequest,
  CreateTaskResponse,
  CustomColorsResponse,
  DeleteTaskResponse,
  Task,
  TaskListParams,
  TaskListResponse,
  TaskPatch,
  TweekApiCalendar,
  TweekApiCustomColorsResponse,
  TweekApiTask,
  TweekApiTaskListResponse,
} from './types.js'
import { Buffer } from 'node:buffer'
import { HttpClient } from '../http/httpClient.js'
import { HttpError, HttpErrorType } from '../http/types.js'
import {
  isCalendarListResponse,
  isCustomColorsResponse,
  isTaskListResponse,
  isTaskResponse,
  mapCalendarListResponse,
  mapCustomColorsResponse,
  mapTask,
  mapTaskListResponse,
} from './mappers.js'

/**
 * Extract user ID from JWT token claims
 */
function extractUserIdFromToken(idToken: string): string {
  try {
    // JWT tokens have 3 parts separated by dots
    const parts = idToken.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format')
    }

    // Decode the payload (second part)
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as Record<string, unknown>

    // Extract user ID - try common claim names
    const userId = (payload.sub as string) ?? (payload.user_id as string) ?? (payload.uid as string)
    if (userId == null || userId === '') {
      throw new Error('No user ID found in token claims')
    }

    return userId
  }
  catch (error) {
    throw new HttpError(
      HttpErrorType.UNAUTHENTICATED,
      401,
      'Unauthorized',
      `Failed to extract user ID from token: ${error instanceof Error ? error.message : 'Unknown error'}`,
    )
  }
}

/**
 * TweekClient provides typed access to Tweek API endpoints
 */
export class TweekClient {
  private readonly httpClient: HttpClient
  private readonly authManager: AuthManager

  constructor(config: AppConfig, authManager: AuthManager) {
    this.httpClient = new HttpClient(config)
    this.authManager = authManager
  }

  /**
   * List all calendars for the authenticated user
   */
  async listCalendars(): Promise<CalendarListResponse> {
    try {
      // Ensure we have a valid token and set it
      const idToken = await this.authManager.getValidIdToken()
      this.httpClient.setAuthorizationHeader(idToken)

      const response = await this.httpClient.get<TweekApiCalendar[]>('/calendars')

      if (!isCalendarListResponse(response.data)) {
        throw new HttpError(
          HttpErrorType.UNKNOWN,
          response.status,
          response.statusText,
          'Invalid calendar list response format',
        )
      }

      return mapCalendarListResponse(response.data)
    }
    catch (error) {
      if (error instanceof HttpError) {
        throw error
      }
      throw new HttpError(
        HttpErrorType.UNKNOWN,
        500,
        'Internal Server Error',
        `Failed to list calendars: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * List tasks with optional filtering and pagination
   */
  async listTasks(params: TaskListParams): Promise<TaskListResponse> {
    try {
      // Ensure we have a valid token and set it
      const idToken = await this.authManager.getValidIdToken()
      this.httpClient.setAuthorizationHeader(idToken)

      const searchParams = new URLSearchParams()
      searchParams.set('calendarId', params.calendarId)

      if (params.startAt != null && params.startAt !== '') {
        searchParams.set('startAt', params.startAt)
      }
      if (params.dateFrom != null && params.dateFrom !== '') {
        searchParams.set('dateFrom', params.dateFrom)
      }
      if (params.dateTo != null && params.dateTo !== '') {
        searchParams.set('dateTo', params.dateTo)
      }

      const response = await this.httpClient.get<TweekApiTaskListResponse>(`/tasks?${searchParams.toString()}`)

      if (!isTaskListResponse(response.data)) {
        throw new HttpError(
          HttpErrorType.UNKNOWN,
          response.status,
          response.statusText,
          'Invalid task list response format',
        )
      }

      return mapTaskListResponse(response.data)
    }
    catch (error) {
      if (error instanceof HttpError) {
        throw error
      }
      throw new HttpError(
        HttpErrorType.UNKNOWN,
        500,
        'Internal Server Error',
        `Failed to list tasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get a single task by ID
   */
  async getTask(taskId: string): Promise<Task> {
    try {
      // Ensure we have a valid token and set it
      const idToken = await this.authManager.getValidIdToken()
      this.httpClient.setAuthorizationHeader(idToken)

      const response = await this.httpClient.get<TweekApiTask>(`/tasks/${taskId}`)

      if (!isTaskResponse(response.data)) {
        throw new HttpError(
          HttpErrorType.UNKNOWN,
          response.status,
          response.statusText,
          'Invalid task response format',
        )
      }

      return mapTask(response.data)
    }
    catch (error) {
      if (error instanceof HttpError) {
        throw error
      }
      throw new HttpError(
        HttpErrorType.UNKNOWN,
        500,
        'Internal Server Error',
        `Failed to get task: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Create a new task
   */
  async createTask(taskData: CreateTaskRequest): Promise<CreateTaskResponse> {
    try {
      // Ensure we have a valid token and set it
      const idToken = await this.authManager.getValidIdToken()
      this.httpClient.setAuthorizationHeader(idToken)

      const response = await this.httpClient.post<{ id: string }>('/tasks', taskData)

      if (response.data == null || typeof response.data.id !== 'string') {
        throw new HttpError(
          HttpErrorType.UNKNOWN,
          response.status,
          response.statusText,
          'Invalid create task response format',
        )
      }

      return { id: response.data.id }
    }
    catch (error) {
      if (error instanceof HttpError) {
        throw error
      }
      throw new HttpError(
        HttpErrorType.UNKNOWN,
        500,
        'Internal Server Error',
        `Failed to create task: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Update an existing task
   */
  async updateTask(taskId: string, patch: TaskPatch): Promise<Task> {
    try {
      // Ensure we have a valid token and set it
      const idToken = await this.authManager.getValidIdToken()
      this.httpClient.setAuthorizationHeader(idToken)

      const response = await this.httpClient.patch<TweekApiTask>(`/tasks/${taskId}`, patch)

      if (!isTaskResponse(response.data)) {
        throw new HttpError(
          HttpErrorType.UNKNOWN,
          response.status,
          response.statusText,
          'Invalid update task response format',
        )
      }

      return mapTask(response.data)
    }
    catch (error) {
      if (error instanceof HttpError) {
        throw error
      }
      throw new HttpError(
        HttpErrorType.UNKNOWN,
        500,
        'Internal Server Error',
        `Failed to update task: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<DeleteTaskResponse> {
    try {
      // Ensure we have a valid token and set it
      const idToken = await this.authManager.getValidIdToken()
      this.httpClient.setAuthorizationHeader(idToken)

      await this.httpClient.delete(`/tasks/${taskId}`)

      return { success: true }
    }
    catch (error) {
      if (error instanceof HttpError) {
        throw error
      }
      throw new HttpError(
        HttpErrorType.UNKNOWN,
        500,
        'Internal Server Error',
        `Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * Get custom colors for the authenticated user
   */
  async getCustomColors(): Promise<CustomColorsResponse> {
    try {
      // Extract user ID from the current ID token
      const idToken = await this.authManager.getValidIdToken()
      this.httpClient.setAuthorizationHeader(idToken)
      const userId = extractUserIdFromToken(idToken)

      const response = await this.httpClient.get<TweekApiCustomColorsResponse>(`/custom-colors/${userId}`)

      if (!isCustomColorsResponse(response.data)) {
        throw new HttpError(
          HttpErrorType.UNKNOWN,
          response.status,
          response.statusText,
          'Invalid custom colors response format',
        )
      }

      return mapCustomColorsResponse(response.data)
    }
    catch (error) {
      if (error instanceof HttpError) {
        throw error
      }
      throw new HttpError(
        HttpErrorType.UNKNOWN,
        500,
        'Internal Server Error',
        `Failed to get custom colors: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }
}
