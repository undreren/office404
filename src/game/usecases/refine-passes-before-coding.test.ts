import { describe, expect, it } from 'vitest'
import { timeElapsed } from '../messages'
import {
  canRefineTask,
  refineRequirementToTasks,
  taskLifecycleLabel,
  taskNeedsRefinement,
} from '../projects'
import { ctxFrom } from '../simulation/simCtx'
import type { GameState, Requirement } from '../types'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('refine-passes-before-coding', () => {
  it('keeps unsplit requirement tasks in refining until tier passes are exhausted', () => {
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
    const ctx = ctxFrom({
      ...state,
      vibingCourseTiers: { refinement: 2 },
    } as GameState)

    const tasks = refineRequirementToTasks(ctx, requirement, {
      refinementTier: 2,
      forceSingle: true,
    })

    expect(tasks).toHaveLength(1)
    const task = tasks[0]!
    expect(task.refinePassesRemaining).toBe(2)
    expect(taskNeedsRefinement(task)).toBe(true)
    expect(taskLifecycleLabel(task, { ...project, tasks: [task] })).toBe('refining')
    expect(task.status).not.toBe('pr_ready')
  })

  it('does not jump tasks to review when all requirements are refined', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const ready: GameState = {
      ...base,
      vibingCourseTiers: { refinement: 2 },
      agents: base.agents.map((a) => ({
        ...a,
        contextUsed: 0,
        compactingRemainingSec: 0,
        status: 'refining' as const,
      })),
      projects: [
        {
          ...project,
          roleCounts: { refine: 1, code: 0, review: 0, test: 0, conductor: 0 },
        },
      ],
    }

    let state: GameState = ready
    for (let tick = 0; tick < 200; tick++) {
      state = dispatchChain(state, [timeElapsed(T0 + tick * 5, 5)])
      const current = state.projects[0]!
      const allRequirementsRefined = current.requirements.every((r) => r.status !== 'open')
      if (!allRequirementsRefined) continue

      const shippable = current.tasks.filter((t) => !t.isReviewComment)
      expect(shippable.length).toBeGreaterThan(0)
      for (const task of shippable) {
        expect(task.status).not.toBe('pr_ready')
        expect(taskLifecycleLabel(task, current)).not.toBe('review')
        if (taskNeedsRefinement(task) && canRefineTask(task)) {
          expect(taskLifecycleLabel(task, current)).toBe('refining')
        } else {
          expect(taskLifecycleLabel(task, current)).toBe('coding')
        }
      }
      return
    }

    throw new Error('requirements never finished refining')
  })
})
