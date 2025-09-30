/**
 * MCP tool for calendar operations
 */

import type { TweekClient } from '../tweek/tweekClient.js'
import type { CalendarListResponse } from '../tweek/types.js'
import { wrapToolError } from './errors.js'

export interface CalendarsToolOptions {
  tweekClient: TweekClient
}

/**
 * MCP tool for listing calendars
 */
export class CalendarsTool {
  private readonly tweekClient: TweekClient

  constructor(options: CalendarsToolOptions) {
    this.tweekClient = options.tweekClient
  }

  /**
   * List all calendars for the authenticated user
   * Returns calendars with stable role enums (ROLE_OWNER, ROLE_EDITOR, ROLE_VIEWER)
   */
  async listCalendars(): Promise<CalendarListResponse> {
    try {
      return await this.tweekClient.listCalendars()
    }
    catch (error) {
      throw wrapToolError(error, 'list calendars')
    }
  }
}
