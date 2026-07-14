import { describe, expect, it } from 'vitest'
import { refinementAutoSplitChance } from './mechanics'
import { refineRequirementToTasks } from './projects'
import { ctxFrom } from './simulation/simCtx'
import type { GameState, Requirement } from './types'
import { initialPlaying } from './usecases/_helpers/initialPlaying'

describe('refineRequirementToTasks', () => {
  it('auto-splits at refinement tier 4 with deterministic rng', () => {
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
      refinementTier: 4,
      forceSplit: true,
    })

    expect(tasks).toHaveLength(2)
    expect(tasks[0]!.storyPointsRequired + tasks[1]!.storyPointsRequired).toBe(5)
    expect(tasks.every((t) => (t.refinePassesRemaining ?? 0) === 0)).toBe(true)
  })

  it('adds 20% auto-split chance per refinement tier', () => {
    expect(refinementAutoSplitChance(0)).toBe(0)
    expect(refinementAutoSplitChance(1)).toBe(0.2)
    expect(refinementAutoSplitChance(4)).toBe(0.8)
    expect(refinementAutoSplitChance(5)).toBe(1)
  })
})
