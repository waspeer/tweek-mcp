/**
 * Tweek client module exports
 */

// Mappers for external use if needed
export {
  mapCalendar,
  mapCalendarListResponse,
  mapCustomColor,
  mapCustomColorsResponse,
  mapTask,
  mapTaskListResponse,
} from './mappers.js'

// Main client class
export { TweekClient } from './tweekClient.js'

// Types and interfaces for public use
export type {
  Calendar,
  CalendarListResponse,
  CalendarRole,
  ChecklistItem,
  CreateTaskRequest,
  CreateTaskResponse,
  CustomColor,
  CustomColorsResponse,
  DeleteTaskResponse,
  Task,
  TaskFrequency,
  TaskListParams,
  TaskListResponse,
  TaskPatch,
  TaskResponse,
} from './types.js'
