import { describe, expect, it } from 'vitest'
import { refineRequirementToTasks } from './projects'
import { ctxFrom } from './simulation/simCtx'
import type { GameState, Requirement } from './types'
import { initialPlaying } from './usecases/_helpers/initialPlaying'

describe('refineRequirementToTasks', () => {
  it('forces a fibonacci split at refinement tier 2+', () => {
    const state = initialPlaying()
    const project = state.projects[0]!
    const requirement: Requirement = {
      id: 'req-5',
      projectId: project.id,
      title: 'Big feature',
      storyPoints: 5,
      status: 'open',
      refinePassesUsed: 0,
    }
    const ctx = ctxFrom(state as GameState)

    const tasks = refineRequirementToTasks(ctx, requirement, {
      refinementTier: 2,
      forceSplit: true,
    })

    expect(tasks).toHaveLength(2)
    expect(tasks[0]!.storyPointsRequired + tasks[1]!.storyPointsRequired).toBe(5)
    expect(tasks.every((t) => t.refinePassesRemaining === 2)).toBe(true)
  })
})
