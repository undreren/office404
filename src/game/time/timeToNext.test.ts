import { describe, expect, it } from 'vitest'
import { MAX_OFFLINE_SECONDS, SECONDS_PER_GAME_DAY } from '../constants'
import { initialPlaying } from '../usecases/_helpers/initialPlaying'
import { T0 } from '../usecases/_helpers/testConstants'
import { wallMsForSimSec } from './timeMath'
import { findNextBoundaryMs } from './nextBoundary'
import { timeToNextAgent, timeToNextCalendar, timeToNextGameState } from './gameStateTime'
import type { Agent, GameState } from '../types'

function agentAt(state: GameState, patch: Partial<Agent>): GameState {
  return {
    ...state,
    agents: state.agents.map((a, i) => (i === 0 ? { ...a, ...patch } : a)),
  }
}

describe('timeToNext', () => {
  it('returns rent boundary when rent is due in the future', () => {
    const state = { ...initialPlaying(), snapshotAt: T0, rentDueInDays: 10 }
    const expected = T0 + wallMsForSimSec(state, 10 * SECONDS_PER_GAME_DAY)
    expect(timeToNextCalendar(state)).toBe(expected)
  })

  it('returns TIME_NEVER when rent is already due (handled on any advance)', () => {
    const state = { ...initialPlaying(), snapshotAt: T0, rentDueInDays: 0 }
    expect(timeToNextCalendar(state)).toBe(Number.POSITIVE_INFINITY)
  })

  it('aggregates the earliest child boundary on game state', () => {
    const base = { ...initialPlaying(), snapshotAt: T0, rentDueInDays: 30 }
    const coding = agentAt(base, {
      job: 'code',
      projectId: base.projects[0]!.id,
      status: 'working',
      taskId: base.projects[0]!.tasks[0]?.id ?? null,
      contextUsed: 0,
    })
    const next = timeToNextGameState(coding)
    expect(Number.isFinite(next)).toBe(true)
    expect(next).toBeGreaterThan(T0)
    expect(next).toBe(timeToNextAgent(coding.agents[0]!, coding))
  })

  it('findNextBoundaryMs jumps to the next event instead of a 1s cap', () => {
    const base = { ...initialPlaying(), snapshotAt: T0, rentDueInDays: 30 }
    const coding = agentAt(base, {
      job: 'code',
      projectId: base.projects[0]!.id,
      status: 'working',
      taskId: base.projects[0]!.tasks[0]?.id ?? null,
      contextUsed: 0,
    })
    const target = T0 + MAX_OFFLINE_SECONDS * 1000
    const boundary = findNextBoundaryMs(coding, target)
    expect(boundary - T0).toBeGreaterThan(1000)
  })
})
