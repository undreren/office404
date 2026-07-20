import { describe, expect, it } from 'vitest'
import {
  refinementSplitDepth,
  refineRequirementToTasks,
  refineTaskToTasks,
} from './projects'
import { ctxFrom } from './simulation/simCtx'
import type { GameState, Requirement, Task } from './types'
import { initialPlaying } from './usecases/_helpers/initialPlaying'

function fullyRefinedTasks(
  ctx: ReturnType<typeof ctxFrom>,
  requirement: Requirement,
  refinementTier: number,
): Task[] {
  let tasks = refineRequirementToTasks(ctx, requirement, { refinementTier })
  let pending = tasks.filter((task) => (task.refinePassesRemaining ?? 0) > 0)

  while (pending.length > 0) {
    const task = pending.shift()!
    const split = refineTaskToTasks(ctx, task)
    tasks = [...tasks.filter((t) => t.id !== task.id), ...split]
    pending.push(...split.filter((t) => (t.refinePassesRemaining ?? 0) > 0))
  }

  return tasks
}

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

  it('leaves refine passes for later splits at tier 2', () => {
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

    const tasks = refineRequirementToTasks(ctx, requirement, { refinementTier: 2 })

    expect(tasks).toHaveLength(2)
    expect(tasks.every((t) => t.refinePassesRemaining === 1)).toBe(true)
  })

  it('reaches the final split layout after all refine passes', () => {
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

    const tasks = fullyRefinedTasks(ctx, requirement, 2)

    expect(tasks.map((task) => task.storyPointsRequired).sort((a, b) => a - b)).toEqual([1, 1, 1, 2])
    expect(tasks.every((t) => (t.refinePassesRemaining ?? 0) === 0)).toBe(true)
  })

  it('does not split 1-SP tasks', () => {
    const state = initialPlaying()
    const project = state.projects[0]!
    const requirement: Requirement = {
      id: 'req-1',
      projectId: project.id,
      title: 'Tiny feature',
      storyPoints: 1,
      status: 'open',
      refinePassesUsed: 0,
    }
    const ctx = ctxFrom(state as GameState)

    const tasks = fullyRefinedTasks(ctx, requirement, 3)

    expect(tasks).toHaveLength(1)
    expect(tasks[0]!.storyPointsRequired).toBe(1)
  })

  it('caps refinement split depth at three', () => {
    expect(refinementSplitDepth(5)).toBe(3)
    expect(refinementSplitDepth(2)).toBe(2)
    expect(refinementSplitDepth(0)).toBe(0)
  })
})
