import process from 'node:process'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { AuthManager } from './auth/authManager.js'
import { AppError } from './auth/errors.js'
import { loadConfigFromEnv } from './config/index.js'
import { CalendarsTool } from './tools/calendarsTool.js'
import { ColorsTool } from './tools/colorsTool.js'
import { formatToolResponse, wrapToolError } from './tools/errors.js'
import { TasksTool } from './tools/tasksTool.js'
import {
  validateCreateTaskArguments,
  validateListTasksArguments,
  validateTaskIdArguments,
  validateUpdateTaskArguments,
} from './tools/validation.js'
import { TweekClient } from './tweek/tweekClient.js'

async function start(): Promise<void> {
  try {
    // Load configuration
    const config = loadConfigFromEnv()

    // Initialize auth manager and try to load tokens
    const authManager = new AuthManager(config)

    try {
      authManager.initialize()
    }
    catch (error) {
      if (error instanceof AppError && error.code === 'TOKENS_NOT_FOUND') {
        console.error('Error: Tweek tokens not found. Please run the one-time setup command:')
        console.error('$ pnpm auth:signin')
        process.exitCode = 1
        return
      }
      throw error
    }

    // Initialize Tweek client and tools
    const tweekClient = new TweekClient(config, authManager)
    const calendarsTool = new CalendarsTool({ tweekClient })
    const tasksTool = new TasksTool({ tweekClient })
    const colorsTool = new ColorsTool({ tweekClient })

    // Create MCP server
    const server = new Server(
      {
        name: 'tweek-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    )

    // Register tools with MCP server
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'listCalendars',
            description: 'List all calendars for the authenticated user with stable role enums',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
          },
          {
            name: 'listTasks',
            description: 'List tasks with optional filtering and pagination',
            inputSchema: {
              type: 'object',
              properties: {
                calendarId: {
                  type: 'string',
                  description: 'ID of the calendar to list tasks from',
                },
                startAt: {
                  type: 'string',
                  description: 'Pagination cursor from previous response (nextDocId)',
                },
                dateFrom: {
                  type: 'string',
                  description: 'Start date filter (ISO 8601 date)',
                },
                dateTo: {
                  type: 'string',
                  description: 'End date filter (ISO 8601 date)',
                },
              },
              required: ['calendarId'],
              additionalProperties: false,
            },
          },
          {
            name: 'getTask',
            description: 'Get a single task by ID',
            inputSchema: {
              type: 'object',
              properties: {
                taskId: {
                  type: 'string',
                  description: 'ID of the task to retrieve',
                },
              },
              required: ['taskId'],
              additionalProperties: false,
            },
          },
          {
            name: 'createTask',
            description: 'Create a new task',
            inputSchema: {
              type: 'object',
              properties: {
                task: {
                  type: 'object',
                  description: 'Task data to create',
                  properties: {
                    calendarId: {
                      type: 'string',
                      description: 'ID of the calendar to create the task in',
                    },
                    title: {
                      type: 'string',
                      description: 'Task title',
                    },
                    description: {
                      type: 'string',
                      description: 'Task description',
                    },
                    completed: {
                      type: 'boolean',
                      description: 'Whether the task is completed',
                    },
                    date: {
                      type: 'string',
                      description: 'Due date (ISO 8601 date)',
                    },
                    isoDate: {
                      type: 'string',
                      description: 'Due datetime (ISO 8601 datetime)',
                    },
                    dtStart: {
                      type: 'string',
                      description: 'Start datetime (ISO 8601 datetime)',
                    },
                    notifyAt: {
                      type: 'string',
                      description: 'Notification datetime (ISO 8601 datetime)',
                    },
                    freq: {
                      type: 'number',
                      description: 'Recurrence frequency (0-7)',
                      minimum: 0,
                      maximum: 7,
                    },
                    checklist: {
                      type: 'array',
                      description: 'Checklist items',
                      items: {
                        type: 'object',
                        properties: {
                          text: {
                            type: 'string',
                            description: 'Checklist item text',
                          },
                          completed: {
                            type: 'boolean',
                            description: 'Whether the item is completed',
                          },
                        },
                        required: ['text'],
                        additionalProperties: false,
                      },
                    },
                    priority: {
                      type: 'number',
                      description: 'Task priority',
                      minimum: 0,
                    },
                    tags: {
                      type: 'array',
                      description: 'Task tags',
                      items: {
                        type: 'string',
                      },
                    },
                    color: {
                      type: 'string',
                      description: 'Task color',
                    },
                  },
                  required: ['calendarId', 'title'],
                  additionalProperties: false,
                },
              },
              required: ['task'],
              additionalProperties: false,
            },
          },
          {
            name: 'updateTask',
            description: 'Update an existing task',
            inputSchema: {
              type: 'object',
              properties: {
                taskId: {
                  type: 'string',
                  description: 'ID of the task to update',
                },
                patch: {
                  type: 'object',
                  description: 'Task fields to update',
                  properties: {
                    title: {
                      type: 'string',
                      description: 'Task title',
                    },
                    description: {
                      type: 'string',
                      description: 'Task description',
                    },
                    completed: {
                      type: 'boolean',
                      description: 'Whether the task is completed',
                    },
                    date: {
                      type: 'string',
                      description: 'Due date (ISO 8601 date)',
                    },
                    isoDate: {
                      type: 'string',
                      description: 'Due datetime (ISO 8601 datetime)',
                    },
                    dtStart: {
                      type: 'string',
                      description: 'Start datetime (ISO 8601 datetime)',
                    },
                    notifyAt: {
                      type: 'string',
                      description: 'Notification datetime (ISO 8601 datetime)',
                    },
                    freq: {
                      type: 'number',
                      description: 'Recurrence frequency (0-7)',
                      minimum: 0,
                      maximum: 7,
                    },
                    checklist: {
                      type: 'array',
                      description: 'Checklist items',
                      items: {
                        type: 'object',
                        properties: {
                          text: {
                            type: 'string',
                            description: 'Checklist item text',
                          },
                          completed: {
                            type: 'boolean',
                            description: 'Whether the item is completed',
                          },
                        },
                        required: ['text'],
                        additionalProperties: false,
                      },
                    },
                    priority: {
                      type: 'number',
                      description: 'Task priority',
                      minimum: 0,
                    },
                    tags: {
                      type: 'array',
                      description: 'Task tags',
                      items: {
                        type: 'string',
                      },
                    },
                    color: {
                      type: 'string',
                      description: 'Task color',
                    },
                  },
                  additionalProperties: false,
                },
              },
              required: ['taskId', 'patch'],
              additionalProperties: false,
            },
          },
          {
            name: 'deleteTask',
            description: 'Delete a task',
            inputSchema: {
              type: 'object',
              properties: {
                taskId: {
                  type: 'string',
                  description: 'ID of the task to delete',
                },
              },
              required: ['taskId'],
              additionalProperties: false,
            },
          },
          {
            name: 'getCustomColors',
            description: 'Get custom colors for the authenticated user',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
          },
        ],
      }
    })

    // Register tool call handlers
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'listCalendars': {
            const result = await calendarsTool.listCalendars()
            return formatToolResponse(result)
          }

          case 'listTasks': {
            const args = validateListTasksArguments(request.params.arguments)
            const result = await tasksTool.listTasks(args)
            return formatToolResponse(result)
          }

          case 'getTask': {
            const args = validateTaskIdArguments(request.params.arguments)
            const result = await tasksTool.getTask(args)
            return formatToolResponse(result)
          }

          case 'createTask': {
            const args = validateCreateTaskArguments(request.params.arguments)
            const result = await tasksTool.createTask(args)
            return formatToolResponse(result)
          }

          case 'updateTask': {
            const args = validateUpdateTaskArguments(request.params.arguments)
            const result = await tasksTool.updateTask(args)
            return formatToolResponse(result)
          }

          case 'deleteTask': {
            const args = validateTaskIdArguments(request.params.arguments)
            const result = await tasksTool.deleteTask(args)
            return formatToolResponse(result)
          }

          case 'getCustomColors': {
            const result = await colorsTool.getCustomColors()
            return formatToolResponse(result)
          }

          default:
            throw new Error(`Unknown tool: ${request.params.name}`)
        }
      }
      catch (error) {
        throw wrapToolError(error, `execute tool ${request.params.name}`)
      }
    })

    // Start the server
    const transport = new StdioServerTransport()
    await server.connect(transport)

    console.error('[tweek-mcp] Server started successfully')
  }
  catch (error) {
    console.error('[tweek-mcp] Fatal error during startup:', error)
    process.exitCode = 1
  }
}

start().catch((error) => {
  console.error('[tweek-mcp] Unexpected error:', error)
  process.exitCode = 1
})
