import { describe, expect, it } from 'vitest'
import { formatGameClock } from './mechanics'

describe('formatGameClock', () => {
  it('starts day 0 at 08:00 AM', () => {
    expect(formatGameClock(0)).toBe('Day 0 - 08:00 AM')
  })

  it('advances through the work day', () => {
    expect(formatGameClock(0.5)).toBe('Day 0 - 08:00 PM')
    expect(formatGameClock(0.25)).toBe('Day 0 - 02:00 PM')
  })

  it('rolls to the next day at 08:00 AM', () => {
    expect(formatGameClock(1)).toBe('Day 1 - 08:00 AM')
    expect(formatGameClock(2)).toBe('Day 2 - 08:00 AM')
  })
})
