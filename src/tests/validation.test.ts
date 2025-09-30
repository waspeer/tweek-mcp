/**
 * Tests for validation utilities
 */

import { describe, expect, it } from 'vitest'
import {
  validateCalendarId,
  validateChecklist,
  validateFrequency,
  validateISODate,
  validateTaskInput,
  validateTaskListParams,
  validateTaskPatch,
  ValidationError,
} from '../tools/validation.js'
import { TaskFrequency } from '../tweek/types.js'

describe('validationError', () => {
  it('should create error with correct properties', () => {
    const error = new ValidationError('Test message', 'testField', 'testValue')

    expect(error.message).toBe('Test message')
    expect(error.field).toBe('testField')
    expect(error.value).toBe('testValue')
    expect(error.name).toBe('ValidationError')
    expect(error).toBeInstanceOf(Error)
  })
})

describe('validateISODate', () => {
  it('should accept valid ISO date formats', () => {
    expect(() => validateISODate('2024-01-15', 'testField')).not.toThrow()
    expect(() => validateISODate('2024-01-15T10:30:00Z', 'testField')).not.toThrow()
    expect(() => validateISODate('2024-01-15T10:30:00.123Z', 'testField')).not.toThrow()
    expect(() => validateISODate('2024-01-15T10:30:00+02:00', 'testField')).not.toThrow()
    expect(() => validateISODate('2024-01-15T10:30:00-05:00', 'testField')).not.toThrow()
  })

  it('should reject invalid date formats', () => {
    expect(() => validateISODate('invalid-date', 'testField')).toThrow(ValidationError)
    expect(() => validateISODate('2024-13-01', 'testField')).toThrow(ValidationError)
    expect(() => validateISODate('2024-01-32', 'testField')).toThrow(ValidationError)
    expect(() => validateISODate('24-01-15', 'testField')).toThrow(ValidationError)
    expect(() => validateISODate('2024/01/15', 'testField')).toThrow(ValidationError)
    expect(() => validateISODate('2024-01-15 10:30:00', 'testField')).toThrow(ValidationError)
  })

  it('should reject invalid datetime values', () => {
    // JavaScript Date constructor auto-corrects some invalid dates like 2024-02-30
    // so we test with completely invalid format that fails Date parsing
    expect(() => validateISODate('2024-01-15T25:00:00Z', 'testField')).toThrow(ValidationError)
    expect(() => validateISODate('2024-01-15T10:60:00Z', 'testField')).toThrow(ValidationError)
    expect(() => validateISODate('2024-01-32T10:00:00Z', 'testField')).toThrow(ValidationError)
  })

  it('should handle empty string without throwing', () => {
    expect(() => validateISODate('', 'testField')).not.toThrow()
  })

  it('should include field name and value in error', () => {
    try {
      validateISODate('invalid', 'myField')
    }
    catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).field).toBe('myField')
      expect((error as ValidationError).value).toBe('invalid')
      expect((error as ValidationError).message).toContain('myField')
    }
  })
})

describe('validateFrequency', () => {
  it('should accept valid frequency values', () => {
    for (let freq = 0; freq <= 7; freq++) {
      expect(() => validateFrequency(freq, 'testField')).not.toThrow()
    }
  })

  it('should accept TaskFrequency enum values', () => {
    Object.values(TaskFrequency).forEach((freq) => {
      if (typeof freq === 'number') {
        expect(() => validateFrequency(freq, 'testField')).not.toThrow()
      }
    })
  })

  it('should reject invalid frequency values', () => {
    expect(() => validateFrequency(-1, 'testField')).toThrow(ValidationError)
    expect(() => validateFrequency(8, 'testField')).toThrow(ValidationError)
    expect(() => validateFrequency(100, 'testField')).toThrow(ValidationError)
  })

  it('should include field name and value in error', () => {
    try {
      validateFrequency(10, 'freqField')
    }
    catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).field).toBe('freqField')
      expect((error as ValidationError).value).toBe(10)
      expect((error as ValidationError).message).toContain('freqField')
    }
  })
})

describe('validateChecklist', () => {
  it('should accept valid checklist items', () => {
    const validChecklists = [
      [{ text: 'Item 1' }],
      [{ text: 'Item 1', completed: true }],
      [{ text: 'Item 1' }, { text: 'Item 2', completed: false }],
      [],
    ]

    validChecklists.forEach((checklist) => {
      expect(() => validateChecklist(checklist, 'testField')).not.toThrow()
    })
  })

  it('should reject non-array input', () => {
    expect(() => validateChecklist('not-array' as never, 'testField')).toThrow(ValidationError)
    expect(() => validateChecklist({} as never, 'testField')).toThrow(ValidationError)
    expect(() => validateChecklist(null as never, 'testField')).toThrow(ValidationError)
  })

  it('should reject items without text', () => {
    expect(() => validateChecklist([{}] as never, 'testField')).toThrow(ValidationError)
    expect(() => validateChecklist([{ text: '' }] as never, 'testField')).toThrow(ValidationError)
    expect(() => validateChecklist([{ text: '   ' }] as never, 'testField')).toThrow(ValidationError)
    expect(() => validateChecklist([{ completed: true }] as never, 'testField')).toThrow(ValidationError)
  })

  it('should reject invalid item structure', () => {
    expect(() => validateChecklist([null] as never, 'testField')).toThrow(ValidationError)
    expect(() => validateChecklist(['string'] as never, 'testField')).toThrow(ValidationError)
    expect(() => validateChecklist([123] as never, 'testField')).toThrow(ValidationError)
  })

  it('should reject invalid completed value', () => {
    expect(() => validateChecklist([{ text: 'Item', completed: 'yes' }] as never, 'testField')).toThrow(ValidationError)
    expect(() => validateChecklist([{ text: 'Item', completed: 1 }] as never, 'testField')).toThrow(ValidationError)
  })

  it('should include array index in error messages', () => {
    try {
      validateChecklist([{ text: 'valid' }, { text: '' }], 'checklist')
    }
    catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).field).toBe('checklist[1].text')
    }
  })
})

describe('validateCalendarId', () => {
  it('should accept valid calendar IDs', () => {
    expect(() => validateCalendarId('cal123', 'testField')).not.toThrow()
    expect(() => validateCalendarId('calendar-id-with-dashes', 'testField')).not.toThrow()
    expect(() => validateCalendarId('cal_123_abc', 'testField')).not.toThrow()
  })

  it('should reject empty or invalid calendar IDs', () => {
    expect(() => validateCalendarId('', 'testField')).toThrow(ValidationError)
    expect(() => validateCalendarId('   ', 'testField')).toThrow(ValidationError)
    expect(() => validateCalendarId(null as never, 'testField')).toThrow(ValidationError)
    expect(() => validateCalendarId(undefined as never, 'testField')).toThrow(ValidationError)
    expect(() => validateCalendarId(123 as never, 'testField')).toThrow(ValidationError)
  })
})

describe('validateTaskInput', () => {
  it('should accept valid task input', () => {
    const validTask = {
      calendarId: 'cal123',
      title: 'Test Task',
      description: 'Test description',
      completed: false,
      date: '2024-01-15',
      freq: TaskFrequency.DAILY,
      checklist: [{ text: 'Item 1', completed: false }],
      priority: 1,
      tags: ['tag1', 'tag2'],
    }

    expect(() => validateTaskInput(validTask)).not.toThrow()
  })

  it('should accept minimal valid task input', () => {
    const minimalTask = {
      calendarId: 'cal123',
      title: 'Test Task',
    }

    expect(() => validateTaskInput(minimalTask)).not.toThrow()
  })

  it('should reject missing required fields', () => {
    expect(() => validateTaskInput({} as never)).toThrow(ValidationError)
    expect(() => validateTaskInput({ calendarId: 'cal123' } as never)).toThrow(ValidationError)
    expect(() => validateTaskInput({ title: 'Test' } as never)).toThrow(ValidationError)
  })

  it('should reject invalid field types', () => {
    const baseTask = { calendarId: 'cal123', title: 'Test Task' }

    expect(() => validateTaskInput({ ...baseTask, completed: 'yes' } as never)).toThrow(ValidationError)
    expect(() => validateTaskInput({ ...baseTask, priority: -1 } as never)).toThrow(ValidationError)
    expect(() => validateTaskInput({ ...baseTask, tags: 'string' } as never)).toThrow(ValidationError)
    expect(() => validateTaskInput({ ...baseTask, tags: [123] } as never)).toThrow(ValidationError)
  })

  it('should validate date fields', () => {
    const baseTask = { calendarId: 'cal123', title: 'Test Task' }

    expect(() => validateTaskInput({ ...baseTask, date: 'invalid-date' })).toThrow(ValidationError)
    expect(() => validateTaskInput({ ...baseTask, notifyAt: 'invalid-date' })).toThrow(ValidationError)
    expect(() => validateTaskInput({ ...baseTask, isoDate: 'invalid-date' })).toThrow(ValidationError)
    expect(() => validateTaskInput({ ...baseTask, dtStart: 'invalid-date' })).toThrow(ValidationError)
  })

  it('should validate frequency field', () => {
    const baseTask = { calendarId: 'cal123', title: 'Test Task' }

    expect(() => validateTaskInput({ ...baseTask, freq: -1 as never })).toThrow(ValidationError)
    expect(() => validateTaskInput({ ...baseTask, freq: 8 as never })).toThrow(ValidationError)
  })

  it('should validate checklist field', () => {
    const baseTask = { calendarId: 'cal123', title: 'Test Task' }

    expect(() => validateTaskInput({ ...baseTask, checklist: [{ text: '' }] })).toThrow(ValidationError)
    expect(() => validateTaskInput({ ...baseTask, checklist: [{}] } as never)).toThrow(ValidationError)
  })
})

describe('validateTaskPatch', () => {
  it('should accept valid task patch', () => {
    const validPatch = {
      title: 'Updated Task',
      description: 'Updated description',
      completed: true,
      date: '2024-01-16',
      freq: TaskFrequency.WEEKLY,
      checklist: [{ text: 'Updated item', completed: true }],
      priority: 2,
      tags: ['updated'],
    }

    expect(() => validateTaskPatch(validPatch)).not.toThrow()
  })

  it('should accept empty patch', () => {
    expect(() => validateTaskPatch({})).not.toThrow()
  })

  it('should accept partial patches', () => {
    expect(() => validateTaskPatch({ title: 'New title' })).not.toThrow()
    expect(() => validateTaskPatch({ completed: true })).not.toThrow()
    expect(() => validateTaskPatch({ priority: 3 })).not.toThrow()
  })

  it('should validate individual fields when present', () => {
    expect(() => validateTaskPatch({ title: '' })).toThrow(ValidationError)
    expect(() => validateTaskPatch({ completed: 'yes' } as never)).toThrow(ValidationError)
    expect(() => validateTaskPatch({ priority: -1 })).toThrow(ValidationError)
    expect(() => validateTaskPatch({ freq: 8 as never })).toThrow(ValidationError)
    expect(() => validateTaskPatch({ date: 'invalid' })).toThrow(ValidationError)
  })

  it('should allow null/undefined values for optional fields', () => {
    expect(() => validateTaskPatch({ date: undefined })).not.toThrow()
    expect(() => validateTaskPatch({ checklist: undefined })).not.toThrow()
  })

  it('should handle null/empty string dates', () => {
    expect(() => validateTaskPatch({ date: '' })).not.toThrow()
    expect(() => validateTaskPatch({ notifyAt: '' })).not.toThrow()
  })
})

describe('validateTaskListParams', () => {
  it('should accept valid task list params', () => {
    const validParams = {
      calendarId: 'cal123',
      startAt: 'doc123',
      dateFrom: '2024-01-01',
      dateTo: '2024-01-31',
    }

    expect(() => validateTaskListParams(validParams)).not.toThrow()
  })

  it('should accept minimal params', () => {
    expect(() => validateTaskListParams({ calendarId: 'cal123' })).not.toThrow()
  })

  it('should reject missing calendarId', () => {
    expect(() => validateTaskListParams({} as never)).toThrow(ValidationError)
    expect(() => validateTaskListParams({ startAt: 'doc123' } as never)).toThrow(ValidationError)
  })

  it('should validate date fields', () => {
    const baseParams = { calendarId: 'cal123' }

    expect(() => validateTaskListParams({ ...baseParams, dateFrom: 'invalid' })).toThrow(ValidationError)
    expect(() => validateTaskListParams({ ...baseParams, dateTo: 'invalid' })).toThrow(ValidationError)
  })

  it('should validate startAt field', () => {
    const baseParams = { calendarId: 'cal123' }

    expect(() => validateTaskListParams({ ...baseParams, startAt: 123 } as never)).toThrow(ValidationError)
  })

  it('should accept undefined optional fields', () => {
    const params = {
      calendarId: 'cal123',
      startAt: undefined,
      dateFrom: undefined,
      dateTo: undefined,
    }

    expect(() => validateTaskListParams(params)).not.toThrow()
  })
})
