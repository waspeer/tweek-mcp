/**
 * Tweek API types and DTOs
 */

// Stable role enums for calendars
export enum CalendarRole {
  ROLE_OWNER = 'ROLE_OWNER',
  ROLE_EDITOR = 'ROLE_EDITOR',
  ROLE_VIEWER = 'ROLE_VIEWER',
}

// Calendar interfaces
export interface Calendar {
  id: string
  name: string
  role: CalendarRole
  color?: string
  description?: string
}

export interface CalendarListResponse {
  calendars: Calendar[]
}

// Task frequency enum (Tweek recurrents 0-7)
export enum TaskFrequency {
  NONE = 0,
  DAILY = 1,
  WEEKLY = 2,
  MONTHLY = 3,
  YEARLY = 4,
  WEEKDAYS = 5,
  WEEKENDS = 6,
  CUSTOM = 7,
}

// Task interfaces
export interface ChecklistItem {
  text: string
  completed?: boolean
}

export interface Task {
  id: string
  calendarId: string
  title: string
  description?: string
  completed?: boolean
  date?: string // ISO 8601 date
  isoDate?: string // ISO 8601 datetime
  dtStart?: string // ISO 8601 datetime
  notifyAt?: string // ISO 8601 datetime
  freq?: TaskFrequency
  checklist?: ChecklistItem[]
  priority?: number
  tags?: string[]
  color?: string
  createdAt?: string
  updatedAt?: string
}

export interface TaskPatch {
  title?: string
  description?: string
  completed?: boolean
  date?: string
  isoDate?: string
  dtStart?: string
  notifyAt?: string
  freq?: TaskFrequency
  checklist?: ChecklistItem[]
  priority?: number
  tags?: string[]
  color?: string
}

export interface CreateTaskRequest {
  calendarId: string
  title: string
  description?: string
  completed?: boolean
  date?: string
  isoDate?: string
  dtStart?: string
  notifyAt?: string
  freq?: TaskFrequency
  checklist?: ChecklistItem[]
  priority?: number
  tags?: string[]
  color?: string
}

export interface TaskListParams {
  calendarId: string
  startAt?: string // nextDocId for pagination
  dateFrom?: string // ISO 8601 date
  dateTo?: string // ISO 8601 date
}

export interface TaskListResponse {
  pageSize: number
  nextDocId?: string
  data: Task[]
}

export interface TaskResponse {
  task: Task
}

export interface CreateTaskResponse {
  id: string
}

export interface DeleteTaskResponse {
  success: true
}

// Custom colors interfaces
export interface CustomColor {
  id: string
  name: string
  hex: string
  userId: string
}

export interface CustomColorsResponse {
  colors: CustomColor[]
}

// API request/response types for internal use
export interface TweekApiCalendar {
  id: string
  name: string
  role: string // Raw string from API
  color?: string
  description?: string
}

export interface TweekApiTask {
  id: string
  calendarId: string
  text: string // API uses "text" not "title"
  note?: string // API uses "note" not "description"
  done?: boolean // API uses "done" not "completed"
  color?: string
  date?: string
  isoDate?: string
  dtStart?: string
  notifyAt?: string
  freq?: number // Raw number from API
  checklist?: { id: string, text: string, done?: boolean, highlighted?: boolean, indent?: number, variant?: string }[]
  gcal?: boolean
  recurrence?: string
  recurringTodoId?: string
  listId?: string
  deleted?: boolean
  isBase?: boolean
  isBaseDeleted?: boolean
  source?: {
    identifier: string
    type: string
    calendarIdentifier?: string
    lastModifiedDate?: string
  }
}

export interface TweekApiTaskListResponse {
  pageSize: number
  nextDocId?: string
  data: TweekApiTask[]
}

export interface TweekApiCustomColor {
  id: string
  name: string
  hex: string
  userId: string
}

export interface TweekApiCustomColorsResponse {
  colors: TweekApiCustomColor[]
}
