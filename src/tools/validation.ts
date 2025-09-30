/**
 * Validation utilities for MCP tool inputs
 */

import type { ChecklistItem, CreateTaskRequest, TaskPatch } from '../tweek/types.js'
import { TaskFrequency } from '../tweek/types.js'

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown,
  ) {
    super(message)
    this.name = 'ValidationError'
    Object.setPrototypeOf(this, ValidationError.prototype)
  }
}

/**
 * Validates ISO 8601 date or datetime string
 */
export function validateISODate(value: string, fieldName: string): void {
  if (!value)
    return

  const isoPattern = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)?$/

  if (!isoPattern.test(value)) {
    throw new ValidationError(
      `${fieldName} must be a valid ISO 8601 date or datetime string`,
      fieldName,
      value,
    )
  }

  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) {
    throw new ValidationError(
      `${fieldName} contains an invalid date`,
      fieldName,
      value,
    )
  }
}

/**
 * Validates task frequency enum
 */
export function validateFrequency(freq: number, fieldName: string): void {
  const validFrequencies = Object.values(TaskFrequency).filter(v => typeof v === 'number') as number[]

  if (!validFrequencies.includes(freq)) {
    throw new ValidationError(
      `${fieldName} must be a valid frequency value (0-7)`,
      fieldName,
      freq,
    )
  }
}

/**
 * Validates checklist items
 */
export function validateChecklist(checklist: ChecklistItem[], fieldName: string): void {
  if (!Array.isArray(checklist)) {
    throw new ValidationError(
      `${fieldName} must be an array`,
      fieldName,
      checklist,
    )
  }

  checklist.forEach((item, index) => {
    if (item == null || typeof item !== 'object') {
      throw new ValidationError(
        `${fieldName}[${index}] must be an object`,
        `${fieldName}[${index}]`,
        item,
      )
    }

    if (!item.text || typeof item.text !== 'string' || item.text.trim() === '') {
      throw new ValidationError(
        `${fieldName}[${index}].text must be a non-empty string`,
        `${fieldName}[${index}].text`,
        item.text,
      )
    }

    if (item.completed !== undefined && typeof item.completed !== 'boolean') {
      throw new ValidationError(
        `${fieldName}[${index}].completed must be a boolean`,
        `${fieldName}[${index}].completed`,
        item.completed,
      )
    }
  })
}

/**
 * Validates calendar ID
 */
export function validateCalendarId(calendarId: string, fieldName: string): void {
  if (!calendarId || typeof calendarId !== 'string' || calendarId.trim() === '') {
    throw new ValidationError(
      `${fieldName} must be a non-empty string`,
      fieldName,
      calendarId,
    )
  }
}

/**
 * Validates task input for creation
 */
export function validateTaskInput(task: CreateTaskRequest): void {
  // Required fields
  validateCalendarId(task.calendarId, 'calendarId')

  if (!task.title || typeof task.title !== 'string' || task.title.trim() === '') {
    throw new ValidationError(
      'title must be a non-empty string',
      'title',
      task.title,
    )
  }

  // Optional field validations
  if (task.freq !== undefined) {
    validateFrequency(task.freq, 'freq')
  }

  if (task.notifyAt != null && task.notifyAt !== '') {
    validateISODate(task.notifyAt, 'notifyAt')
  }

  if (task.date != null && task.date !== '') {
    validateISODate(task.date, 'date')
  }

  if (task.isoDate != null && task.isoDate !== '') {
    validateISODate(task.isoDate, 'isoDate')
  }

  if (task.dtStart != null && task.dtStart !== '') {
    validateISODate(task.dtStart, 'dtStart')
  }

  if (task.checklist) {
    validateChecklist(task.checklist, 'checklist')
  }

  if (task.completed !== undefined && typeof task.completed !== 'boolean') {
    throw new ValidationError(
      'completed must be a boolean',
      'completed',
      task.completed,
    )
  }

  if (task.priority !== undefined && (typeof task.priority !== 'number' || task.priority < 0)) {
    throw new ValidationError(
      'priority must be a non-negative number',
      'priority',
      task.priority,
    )
  }

  if (task.tags !== undefined) {
    if (!Array.isArray(task.tags)) {
      throw new ValidationError(
        'tags must be an array',
        'tags',
        task.tags,
      )
    }

    task.tags.forEach((tag, index) => {
      if (typeof tag !== 'string') {
        throw new ValidationError(
          `tags[${index}] must be a string`,
          `tags[${index}]`,
          tag,
        )
      }
    })
  }
}

/**
 * Validates task patch for updates
 */
export function validateTaskPatch(patch: TaskPatch): void {
  // All fields are optional for patches, but if present must be valid
  if (patch.title !== undefined) {
    if (!patch.title || typeof patch.title !== 'string' || patch.title.trim() === '') {
      throw new ValidationError(
        'title must be a non-empty string',
        'title',
        patch.title,
      )
    }
  }

  if (patch.freq !== undefined) {
    validateFrequency(patch.freq, 'freq')
  }

  if (patch.notifyAt !== undefined) {
    if (patch.notifyAt) {
      validateISODate(patch.notifyAt, 'notifyAt')
    }
  }

  if (patch.date !== undefined) {
    if (patch.date) {
      validateISODate(patch.date, 'date')
    }
  }

  if (patch.isoDate !== undefined) {
    if (patch.isoDate) {
      validateISODate(patch.isoDate, 'isoDate')
    }
  }

  if (patch.dtStart !== undefined) {
    if (patch.dtStart) {
      validateISODate(patch.dtStart, 'dtStart')
    }
  }

  if (patch.checklist !== undefined) {
    if (patch.checklist != null) {
      validateChecklist(patch.checklist, 'checklist')
    }
  }

  if (patch.completed !== undefined && typeof patch.completed !== 'boolean') {
    throw new ValidationError(
      'completed must be a boolean',
      'completed',
      patch.completed,
    )
  }

  if (patch.priority !== undefined && (typeof patch.priority !== 'number' || patch.priority < 0)) {
    throw new ValidationError(
      'priority must be a non-negative number',
      'priority',
      patch.priority,
    )
  }

  if (patch.tags !== undefined) {
    if (!Array.isArray(patch.tags)) {
      throw new ValidationError(
        'tags must be an array',
        'tags',
        patch.tags,
      )
    }

    patch.tags.forEach((tag, index) => {
      if (typeof tag !== 'string') {
        throw new ValidationError(
          `tags[${index}] must be a string`,
          `tags[${index}]`,
          tag,
        )
      }
    })
  }
}

/**
 * Validates task ID
 */
export function validateTaskId(taskId: string, fieldName: string): void {
  if (!taskId || typeof taskId !== 'string' || taskId.trim() === '') {
    throw new ValidationError(
      `${fieldName} must be a non-empty string`,
      fieldName,
      taskId,
    )
  }
}

/**
 * Validates pagination cursor format
 */
export function validatePaginationCursor(cursor: string, fieldName: string): void {
  if (!cursor || typeof cursor !== 'string' || cursor.trim() === '') {
    throw new ValidationError(
      `${fieldName} must be a non-empty string`,
      fieldName,
      cursor,
    )
  }
}

/**
 * Validates task list parameters
 */
export function validateTaskListParams(params: { calendarId: string, startAt?: string, dateFrom?: string, dateTo?: string }): void {
  validateCalendarId(params.calendarId, 'calendarId')

  if (params.dateFrom != null && params.dateFrom !== '') {
    validateISODate(params.dateFrom, 'dateFrom')
  }

  if (params.dateTo != null && params.dateTo !== '') {
    validateISODate(params.dateTo, 'dateTo')
  }

  if (params.startAt !== undefined) {
    if (typeof params.startAt !== 'string') {
      throw new ValidationError(
        'startAt must be a string',
        'startAt',
        params.startAt,
      )
    }
    if (params.startAt !== '') {
      validatePaginationCursor(params.startAt, 'startAt')
    }
  }
}

/**
 * Validates and parses tool arguments for listTasks
 */
export function validateListTasksArguments(args: unknown): { calendarId: string, startAt?: string, dateFrom?: string, dateTo?: string } {
  if (args == null || typeof args !== 'object' || Array.isArray(args)) {
    throw new ValidationError(
      'Arguments must be an object',
      'arguments',
      args,
    )
  }

  const params = args as Record<string, unknown>

  const result: { calendarId: string, startAt?: string, dateFrom?: string, dateTo?: string } = {
    calendarId: '',
  }

  if (typeof params.calendarId !== 'string') {
    throw new ValidationError(
      'calendarId must be a string',
      'calendarId',
      params.calendarId,
    )
  }
  result.calendarId = params.calendarId

  if (params.startAt !== undefined) {
    if (typeof params.startAt !== 'string') {
      throw new ValidationError(
        'startAt must be a string',
        'startAt',
        params.startAt,
      )
    }
    result.startAt = params.startAt
  }

  if (params.dateFrom !== undefined) {
    if (typeof params.dateFrom !== 'string') {
      throw new ValidationError(
        'dateFrom must be a string',
        'dateFrom',
        params.dateFrom,
      )
    }
    result.dateFrom = params.dateFrom
  }

  if (params.dateTo !== undefined) {
    if (typeof params.dateTo !== 'string') {
      throw new ValidationError(
        'dateTo must be a string',
        'dateTo',
        params.dateTo,
      )
    }
    result.dateTo = params.dateTo
  }

  validateTaskListParams(result)
  return result
}

/**
 * Validates and parses tool arguments for getTask/deleteTask
 */
export function validateTaskIdArguments(args: unknown): { taskId: string } {
  if (args == null || typeof args !== 'object' || Array.isArray(args)) {
    throw new ValidationError(
      'Arguments must be an object',
      'arguments',
      args,
    )
  }

  const params = args as Record<string, unknown>

  if (typeof params.taskId !== 'string') {
    throw new ValidationError(
      'taskId must be a string',
      'taskId',
      params.taskId,
    )
  }

  validateTaskId(params.taskId, 'taskId')
  return { taskId: params.taskId }
}

/**
 * Validates and parses tool arguments for createTask
 */
export function validateCreateTaskArguments(args: unknown): { task: CreateTaskRequest } {
  if (args == null || typeof args !== 'object' || Array.isArray(args)) {
    throw new ValidationError(
      'Arguments must be an object',
      'arguments',
      args,
    )
  }

  const params = args as Record<string, unknown>

  if (params.task == null || typeof params.task !== 'object' || Array.isArray(params.task)) {
    throw new ValidationError(
      'task must be an object',
      'task',
      params.task,
    )
  }

  const task = params.task as CreateTaskRequest
  validateTaskInput(task)
  return { task }
}

/**
 * Validates and parses tool arguments for updateTask
 */
export function validateUpdateTaskArguments(args: unknown): { taskId: string, patch: TaskPatch } {
  if (args == null || typeof args !== 'object' || Array.isArray(args)) {
    throw new ValidationError(
      'Arguments must be an object',
      'arguments',
      args,
    )
  }

  const params = args as Record<string, unknown>

  if (typeof params.taskId !== 'string') {
    throw new ValidationError(
      'taskId must be a string',
      'taskId',
      params.taskId,
    )
  }

  if (params.patch == null || typeof params.patch !== 'object' || Array.isArray(params.patch)) {
    throw new ValidationError(
      'patch must be an object',
      'patch',
      params.patch,
    )
  }

  validateTaskId(params.taskId, 'taskId')
  const patch = params.patch as TaskPatch
  validateTaskPatch(patch)

  return { taskId: params.taskId, patch }
}
