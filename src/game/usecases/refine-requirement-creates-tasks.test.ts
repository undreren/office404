import { describe, expect, it } from 'vitest'
import { timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { GameState } from '../types'

describe('refine-requirement-creates-tasks', () => {
  it('matches use case invariants', () => {
    const base = initialPlaying()
    const ready: GameState = {
      ...base,
      agents: base.agents.map((a) => ({
        ...a,
        contextUsed: 0,
        compactingRemainingSec: 0,
        status: 'refining' as const,
      })),
    }

    let state: GameState = ready
    for (let tick = 0; tick < 50 && state.projects[0]!.tasks.length === 0; tick++) {
      state = dispatchChain(state, [timeElapsed(T0 + tick * 5, 5)])
    }

    expect(state.projects[0]!.tasks.length).toBeGreaterThan(0)
    expect(state.projects[0]!.requirements.some((r) => r.status !== 'open')).toBe(true)
  })
})
