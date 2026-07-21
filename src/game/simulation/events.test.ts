import { describe, expect, it } from 'vitest'
import { MAX_EVENTS } from '../constants'
import type { GameEvent } from '../types'
import { prependEvents } from './events'

function event(id: string): GameEvent {
  return { id, timestamp: 0, type: 'system', message: id }
}

describe('prependEvents', () => {
  it(`keeps only the latest ${MAX_EVENTS} entries`, () => {
    const existing = Array.from({ length: MAX_EVENTS }, (_, i) => event(`evt-${i}`))
    const next = prependEvents(existing, event('evt-new'))

    expect(next).toHaveLength(MAX_EVENTS)
    expect(next[0]?.id).toBe('evt-new')
    expect(next[MAX_EVENTS - 1]?.id).toBe(`evt-${MAX_EVENTS - 2}`)
  })
})
