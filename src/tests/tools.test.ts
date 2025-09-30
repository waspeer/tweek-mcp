/**
 * Tests for MCP tools
 */
/* eslint-disable ts/unbound-method */

import type { TweekClient } from '../tweek/tweekClient.js'
import type { CreateTaskRequest, TaskPatch } from '../tweek/types.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError, HttpErrorType } from '../http/types.js'
import { CalendarsTool } from '../tools/calendarsTool.js'
import { ColorsTool } from '../tools/colorsTool.js'
import { TasksTool } from '../tools/tasksTool.js'
import { CalendarRole, TaskFrequency } from '../tweek/types.js'

// Mock TweekClient
const mockTweekClient = {
  listCalendars: vi.fn(),
  listTasks: vi.fn(),
  getTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  getCustomColors: vi.fn(),
} as unknown as TweekClient

async function expectValidationError(operation: () => Promise<any>) {
  await expect(operation()).rejects.toThrow(Error)
  try {
    await operation()
  }
  catch (error) {
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('Validation error')
  }
}

describe('calendarsTool', () => {
  let calendarsTool: CalendarsTool

  beforeEach(() => {
    vi.clearAllMocks()
    calendarsTool = new CalendarsTool({ tweekClient: mockTweekClient })
  })

  describe('listCalendars', () => {
    it('should return calendars from TweekClient', async () => {
      const mockCalendars = {
        calendars: [
          {
            id: 'cal1',
            name: 'Calendar 1',
            role: CalendarRole.ROLE_OWNER,
            color: '#ff0000',
          },
          {
            id: 'cal2',
            name: 'Calendar 2',
            role: CalendarRole.ROLE_EDITOR,
          },
        ],
      }

      vi.mocked(mockTweekClient.listCalendars).mockResolvedValue(mockCalendars)

      const result = await calendarsTool.listCalendars()

      expect(result).toEqual(mockCalendars)
      expect(vi.mocked(mockTweekClient.listCalendars)).toHaveBeenCalledOnce()
    })

    it('should propagate HttpError from TweekClient', async () => {
      const httpError = new HttpError(
        HttpErrorType.UNAUTHENTICATED,
        401,
        'Unauthorized',
        'Token expired',
      )

      vi.mocked(mockTweekClient.listCalendars).mockRejectedValue(httpError)

      await expect(calendarsTool.listCalendars()).rejects.toThrow(Error)
      await expect(calendarsTool.listCalendars()).rejects.toThrow('HTTP error')
    })

    it('should wrap unexpected errors', async () => {
      const unexpectedError = new Error('Network error')
      vi.mocked(mockTweekClient.listCalendars).mockRejectedValue(unexpectedError)

      await expect(calendarsTool.listCalendars()).rejects.toThrow(Error)
      await expect(calendarsTool.listCalendars()).rejects.toThrow('Failed to list calendars')
    })
  })
})

describe('colorsTool', () => {
  let colorsTool: ColorsTool

  beforeEach(() => {
    vi.clearAllMocks()
    colorsTool = new ColorsTool({ tweekClient: mockTweekClient })
  })

  describe('getCustomColors', () => {
    it('should return custom colors from TweekClient', async () => {
      const mockColors = {
        colors: [
          {
            id: 'color1',
            name: 'Red',
            hex: '#ff0000',
            userId: 'user123',
          },
          {
            id: 'color2',
            name: 'Blue',
            hex: '#0000ff',
            userId: 'user123',
          },
        ],
      }

      vi.mocked(mockTweekClient.getCustomColors).mockResolvedValue(mockColors)

      const result = await colorsTool.getCustomColors()

      expect(result).toEqual(mockColors)
      expect(vi.mocked(mockTweekClient.getCustomColors)).toHaveBeenCalledOnce()
    })

    it('should propagate HttpError from TweekClient', async () => {
      const httpError = new HttpError(
        HttpErrorType.NOT_FOUND,
        404,
        'Not Found',
        'User not found',
      )

      vi.mocked(mockTweekClient.getCustomColors).mockRejectedValue(httpError)

      await expect(colorsTool.getCustomColors()).rejects.toThrow(Error)
      await expect(colorsTool.getCustomColors()).rejects.toThrow('HTTP error')
    })

    it('should wrap unexpected errors', async () => {
      const unexpectedError = new Error('Database error')
      vi.mocked(mockTweekClient.getCustomColors).mockRejectedValue(unexpectedError)

      await expect(colorsTool.getCustomColors()).rejects.toThrow(Error)
      await expect(colorsTool.getCustomColors()).rejects.toThrow('Failed to get custom colors')
    })
  })
})

describe('tasksTool', () => {
  let tasksTool: TasksTool

  beforeEach(() => {
    vi.clearAllMocks()
    tasksTool = new TasksTool({ tweekClient: mockTweekClient })
  })

  describe('listTasks', () => {
    it('should return tasks from TweekClient with valid params', async () => {
      const params = {
        calendarId: 'cal123',
        startAt: 'doc123',
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
      }

      const mockResponse = {
        pageSize: 10,
        nextDocId: 'doc456',
        data: [
          {
            id: 'task1',
            calendarId: 'cal123',
            title: 'Test Task',
            completed: false,
          },
        ],
      }

      vi.mocked(mockTweekClient.listTasks).mockResolvedValue(mockResponse)

      const result = await tasksTool.listTasks(params)

      expect(result).toEqual(mockResponse)
      expect(vi.mocked(mockTweekClient.listTasks)).toHaveBeenCalledWith(params)
    })

    it('should validate params and reject invalid calendarId', async () => {
      const invalidParams = {
        calendarId: '',
        startAt: 'doc123',
      }

      await expectValidationError(async () => tasksTool.listTasks(invalidParams))
    })

    it('should validate params and reject invalid dates', async () => {
      const invalidParams = {
        calendarId: 'cal123',
        dateFrom: 'invalid-date',
      }

      await expectValidationError(async () => tasksTool.listTasks(invalidParams))
    })

    it('should propagate HttpError from TweekClient', async () => {
      const params = { calendarId: 'cal123' }
      const httpError = new HttpError(
        HttpErrorType.NOT_FOUND,
        404,
        'Not Found',
        'Calendar not found',
      )

      vi.mocked(mockTweekClient.listTasks).mockRejectedValue(httpError)

      await expect(tasksTool.listTasks(params)).rejects.toThrow(Error)
      await expect(tasksTool.listTasks(params)).rejects.toThrow('HTTP error')
    })
  })

  describe('getTask', () => {
    it('should return task from TweekClient', async () => {
      const taskId = 'task123'
      const mockTask = {
        id: taskId,
        calendarId: 'cal123',
        title: 'Test Task',
        completed: false,
      }

      vi.mocked(mockTweekClient.getTask).mockResolvedValue(mockTask)

      const result = await tasksTool.getTask({ taskId })

      expect(result).toEqual({ task: mockTask })
      expect(vi.mocked(mockTweekClient.getTask)).toHaveBeenCalledWith(taskId)
    })

    it('should validate taskId and reject empty string', async () => {
      await expectValidationError(async () => tasksTool.getTask({ taskId: '' }))
    })

    it('should validate taskId and reject non-string', async () => {
      await expectValidationError(async () => tasksTool.getTask({ taskId: 123 as unknown as string }))
    })
  })

  describe('createTask', () => {
    it('should create task with valid input', async () => {
      const taskData = {
        calendarId: 'cal123',
        title: 'New Task',
        description: 'Task description',
        completed: false,
        freq: TaskFrequency.DAILY,
        checklist: [{ text: 'Item 1', completed: false }],
      }

      const mockResponse = { id: 'task123' }
      vi.mocked(mockTweekClient.createTask).mockResolvedValue(mockResponse)

      const result = await tasksTool.createTask({ task: taskData })

      expect(result).toEqual(mockResponse)
      expect(vi.mocked(mockTweekClient.createTask)).toHaveBeenCalledWith(taskData)
    })

    it('should validate task input and reject missing required fields', async () => {
      const invalidTask = {
        title: 'Task without calendar ID',
      }

      await expectValidationError(async () => tasksTool.createTask({ task: invalidTask as unknown as CreateTaskRequest }))
    })

    it('should validate task input and reject invalid frequency', async () => {
      const invalidTask = {
        calendarId: 'cal123',
        title: 'Valid Task',
        freq: 10, // Invalid frequency
      }

      await expectValidationError(async () => tasksTool.createTask({ task: invalidTask }))
    })

    it('should validate task input and reject invalid dates', async () => {
      const invalidTask = {
        calendarId: 'cal123',
        title: 'Valid Task',
        date: 'invalid-date',
      }

      await expectValidationError(async () => tasksTool.createTask({ task: invalidTask }))
    })

    it('should validate task input and reject invalid checklist', async () => {
      const invalidTask = {
        calendarId: 'cal123',
        title: 'Valid Task',
        checklist: [{ text: '' }], // Empty text
      }

      await expectValidationError(async () => tasksTool.createTask({ task: invalidTask }))
    })
  })

  describe('updateTask', () => {
    it('should update task with valid input', async () => {
      const taskId = 'task123'
      const patch = {
        title: 'Updated Task',
        completed: true,
        priority: 2,
      }

      const mockUpdatedTask = {
        id: taskId,
        calendarId: 'cal123',
        title: 'Updated Task',
        completed: true,
        priority: 2,
      }

      vi.mocked(mockTweekClient.updateTask).mockResolvedValue(mockUpdatedTask)

      const result = await tasksTool.updateTask({ taskId, patch })

      expect(result).toEqual({ task: mockUpdatedTask })
      expect(vi.mocked(mockTweekClient.updateTask)).toHaveBeenCalledWith(taskId, patch)
    })

    it('should validate taskId', async () => {
      const patch = { title: 'Updated' }

      await expectValidationError(async () => tasksTool.updateTask({ taskId: '', patch }))
    })

    it('should validate patch object', async () => {
      const taskId = 'task123'

      await expectValidationError(async () => tasksTool.updateTask({ taskId, patch: null as unknown as TaskPatch }))
    })

    it('should validate patch fields', async () => {
      const taskId = 'task123'
      const invalidPatch = {
        title: '', // Empty title
        priority: -1, // Negative priority
      }

      await expectValidationError(async () => tasksTool.updateTask({ taskId, patch: invalidPatch }))
    })
  })

  describe('deleteTask', () => {
    it('should delete task successfully', async () => {
      const taskId = 'task123'
      const mockResponse = { success: true as const }

      vi.mocked(mockTweekClient.deleteTask).mockResolvedValue(mockResponse)

      const result = await tasksTool.deleteTask({ taskId })

      expect(result).toEqual(mockResponse)
      expect(vi.mocked(mockTweekClient.deleteTask)).toHaveBeenCalledWith(taskId)
    })

    it('should validate taskId', async () => {
      await expectValidationError(async () => tasksTool.deleteTask({ taskId: '' }))
    })
  })

  describe('error handling', () => {
    it('should convert ValidationError to Error with descriptive message', async () => {
      const invalidParams = { calendarId: '' }

      try {
        await tasksTool.listTasks(invalidParams)
        expect.fail('Expected validation error')
      }
      catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('Validation error')
        expect((error as Error).message).toContain('calendarId')
      }
    })

    it('should wrap HttpError with descriptive message', async () => {
      const params = { calendarId: 'cal123' }
      const httpError = new HttpError(
        HttpErrorType.UNAUTHENTICATED,
        401,
        'Unauthorized',
        'Token expired',
      )

      vi.mocked(mockTweekClient.listTasks).mockRejectedValue(httpError)

      await expect(tasksTool.listTasks(params)).rejects.toThrow(Error)
      await expect(tasksTool.listTasks(params)).rejects.toThrow('HTTP error')
    })

    it('should wrap unexpected errors with operation context', async () => {
      const params = { calendarId: 'cal123' }
      const unexpectedError = new Error('Network timeout')

      vi.mocked(mockTweekClient.listTasks).mockRejectedValue(unexpectedError)

      try {
        await tasksTool.listTasks(params)
      }
      catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('Failed to list tasks')
        expect((error as Error).message).toContain('Network timeout')
      }
    })
  })
})
