import { describe, expect, it } from 'vitest'
import { refinementSplitDepth, refineRequirementToTasks, storyPointsAfterRefinementSplit } from './projects'
import { ctxFrom } from './simulation/simCtx'
import type { GameState, Requirement } from './types'
import { initialPlaying } from './usecases/_helpers/initialPlaying'

describe('refineRequirementToTasks', () => {
  it('keeps a single task at refinement tier 0', () => {
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

    const tasks = refineRequirementToTasks(ctx, requirement, { refinementTier: 0 })

    expect(tasks).toHaveLength(1)
    expect(tasks[0]!.storyPointsRequired).toBe(5)
    expect(tasks[0]!.refinePassesRemaining).toBe(0)
  })

  it('splits once at refinement tier 1', () => {
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

    const tasks = refineRequirementToTasks(ctx, requirement, { refinementTier: 1 })

    expect(tasks).toHaveLength(2)
    expect(tasks[0]!.storyPointsRequired + tasks[1]!.storyPointsRequired).toBe(5)
    expect(tasks.every((t) => (t.refinePassesRemaining ?? 0) === 0)).toBe(true)
  })

  it('recursively splits to depth 2', () => {
    expect(storyPointsAfterRefinementSplit(5, 2)).toEqual([2, 1, 1, 1])
    expect(storyPointsAfterRefinementSplit(5, 2).reduce((sum, sp) => sum + sp, 0)).toBe(5)
  })

  it('does not split 1-SP tasks', () => {
    expect(storyPointsAfterRefinementSplit(1, 3)).toEqual([1])
  })

  it('caps refinement split depth at three', () => {
    expect(refinementSplitDepth(5)).toBe(3)
    expect(refinementSplitDepth(2)).toBe(2)
    expect(refinementSplitDepth(0)).toBe(0)
  })
})
