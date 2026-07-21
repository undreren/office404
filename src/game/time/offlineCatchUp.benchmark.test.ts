import { describe, expect, it } from 'vitest'
import { VIBING_COURSES } from '../upgrades'
import { AUTOMATION_AGENT_JOBS } from '../mechanics'
import { createInitialState, reconcileSpecialistAgents } from '../simulation/gameLogic'
import { ctxFrom } from '../simulation/simCtx'
import type { GameState } from '../types'
import { T0 } from '../usecases/_helpers/testConstants'
import { catchUpOffline } from './offlineCatchUp'

const ONE_HOUR_MS = 60 * 60 * 1000
const CATCH_UP_BUDGET_MS = 1000

/** Fresh post-tutorial save with every vibe course maxed and all specialists assigned. */
export function offlineCatchUpBenchmarkState(at: number = T0): GameState {
  const vibingCourses = VIBING_COURSES.map((c) => c.id)
  const vibingCourseTiers = Object.fromEntries(VIBING_COURSES.map((c) => [c.id, c.maxTier ?? 1]))
  const base = createInitialState(at, 42, undefined, { includeTutorial: false })
  const ctx = ctxFrom(base)
  return reconcileSpecialistAgents(
    {
      ...base,
      cash: 2_000_000_000,
      tutorialDone: true,
      vibingCourses,
      vibingCourseTiers,
      assignedSpecialistRoles: [...AUTOMATION_AGENT_JOBS],
      agentSlotPurchases: 8,
      gpuTickPurchases: 4,
      snapshotAt: at,
      events: [],
    },
    ctx,
  )
}

describe('offline catch-up benchmark', () => {
  it('simulates one hour away in under 1 second', () => {
    const before = offlineCatchUpBenchmarkState(T0)
    const targetAt = T0 + ONE_HOUR_MS

    const start = performance.now()
    const after = catchUpOffline(before, targetAt)
    const elapsedMs = performance.now() - start

    expect(after.snapshotAt).toBe(targetAt)
    expect(elapsedMs).toBeLessThan(CATCH_UP_BUDGET_MS)
  })
})
