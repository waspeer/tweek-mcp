/**
 * MCP tool for custom colors operations
 */

import type { TweekClient } from '../tweek/tweekClient.js'
import type { CustomColorsResponse } from '../tweek/types.js'
import { wrapToolError } from './errors.js'

export interface ColorsToolOptions {
  tweekClient: TweekClient
}

/**
 * MCP tool for custom colors operations
 */
export class ColorsTool {
  private readonly tweekClient: TweekClient

  constructor(options: ColorsToolOptions) {
    this.tweekClient = options.tweekClient
  }

  /**
   * Get custom colors for the authenticated user
   * Automatically extracts userId from the idToken claims
   */
  async getCustomColors(): Promise<CustomColorsResponse> {
    try {
      return await this.tweekClient.getCustomColors()
    }
    catch (error) {
      throw wrapToolError(error, 'get custom colors')
    }
  }
}
