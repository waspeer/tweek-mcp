/**
 * MCP tool for task operations (CRUD)
 */

import type { TweekClient } from '../tweek/tweekClient.js'
import type {
  CreateTaskRequest,
  CreateTaskResponse,
  DeleteTaskResponse,
  Task,
  TaskListParams,
  TaskListResponse,
  TaskPatch,
} from '../tweek/types.js'
import { wrapToolError } from './errors.js'
import {
  validateTaskId,
  validateTaskInput,
  validateTaskListParams,
  validateTaskPatch,
  ValidationError,
} from './validation.js'

export interface TasksToolOptions {
  tweekClient: TweekClient
}

/**
 * MCP tool for task CRUD operations
 */
export class TasksTool {
  private readonly tweekClient: TweekClient

  constructor(options: TasksToolOptions) {
    this.tweekClient = options.tweekClient
  }

  /**
   * List tasks with optional filtering and pagination
   */
  async listTasks(params: TaskListParams): Promise<TaskListResponse> {
    try {
      // Validate input parameters
      validateTaskListParams(params)

      return await this.tweekClient.listTasks(params)
    }
    catch (error) {
      throw wrapToolError(error, 'list tasks')
    }
  }

  /**
   * Get a single task by ID
   */
  async getTask(params: { taskId: string }): Promise<{ task: Task }> {
    try {
      validateTaskId(params.taskId, 'taskId')

      const task = await this.tweekClient.getTask(params.taskId)
      return { task }
    }
    catch (error) {
      throw wrapToolError(error, 'get task')
    }
  }

  /**
   * Create a new task
   */
  async createTask(params: { task: CreateTaskRequest }): Promise<CreateTaskResponse> {
    try {
      // Validate the task input
      if (params.task == null || typeof params.task !== 'object') {
        throw new ValidationError(
          'task must be an object',
          'task',
          params.task,
        )
      }

      validateTaskInput(params.task)

      return await this.tweekClient.createTask(params.task)
    }
    catch (error) {
      throw wrapToolError(error, 'create task')
    }
  }

  /**
   * Update an existing task
   */
  async updateTask(params: { taskId: string, patch: TaskPatch }): Promise<{ task: Task }> {
    try {
      validateTaskId(params.taskId, 'taskId')

      if (params.patch == null || typeof params.patch !== 'object') {
        throw new ValidationError(
          'patch must be an object',
          'patch',
          params.patch,
        )
      }

      validateTaskPatch(params.patch)

      const task = await this.tweekClient.updateTask(params.taskId, params.patch)
      return { task }
    }
    catch (error) {
      throw wrapToolError(error, 'update task')
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(params: { taskId: string }): Promise<DeleteTaskResponse> {
    try {
      validateTaskId(params.taskId, 'taskId')

      return await this.tweekClient.deleteTask(params.taskId)
    }
    catch (error) {
      throw wrapToolError(error, 'delete task')
    }
  }
}
