import { describe, expect, it } from 'vitest'
import { buyVibingCourseMsg, timeElapsed } from '../messages'
import {
  canRefineRequirement,
  canRefineTask,
  refineRequirementToTasks,
  taskLifecycleLabel,
  taskNeedsRefinement,
} from '../projects'
import { ctxFrom } from '../simulation/simCtx'
import type { Agent, GameState, Requirement } from '../types'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('refine-unsplittable-requirement-stays-refinable', () => {
  it('requirement marked refined while task still has refine passes keeps task in refining state', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const requirement: Requirement = {
      id: 'req-1',
      projectId: project.id,
      title: 'Tiny feature',
      storyPoints: 1,
      status: 'open',
      refinePassesUsed: 0,
    }
    const ctx = ctxFrom({ ...base, vibingCourseTiers: { refinement: 2 } } as GameState)
    const tasks = refineRequirementToTasks(ctx, requirement, { refinementTier: 2 })

    expect(tasks).toHaveLength(1)
    expect(tasks[0]!.refinePassesRemaining).toBe(1)
    expect(taskNeedsRefinement(tasks[0]!)).toBe(true)

    const refinedRequirement = { ...requirement, status: 'refined' as const }
    expect(canRefineRequirement(refinedRequirement)).toBe(false)
    expect(canRefineTask(tasks[0]!)).toBe(true)
    expect(taskLifecycleLabel(tasks[0]!, { ...project, tasks, requirements: [refinedRequirement] })).toBe(
      'refining',
    )
  })

  it('simulation keeps refining 1-SP tasks until passes are exhausted', () => {
    const base = initialPlaying(7)
    const project = base.projects[0]!
    const template = base.agents[0]!
    const tinyReq: Requirement = {
      id: 'req-tiny',
      projectId: project.id,
      title: 'One-point wonder',
      storyPoints: 1,
      status: 'open',
      refinePassesUsed: 0,
    }

    let state: GameState = {
      ...base,
      vibingCourseTiers: { refinement: 2 },
      agents: [
        {
          ...template,
          contextUsed: 0,
          compactingRemainingSec: 0,
          status: 'refining',
        } as Agent,
      ],
      projects: [
        {
          ...project,
          requirements: [tinyReq],
          tasks: [],
          roleCounts: { refine: 1, code: 0, review: 0, test: 0, conductor: 0 },
        },
      ],
    }

    state = dispatchChain(state, [
      buyVibingCourseMsg(T0, 'refinement'),
      buyVibingCourseMsg(T0 + 1, 'refinement'),
    ])

    let sawRefinableAfterReqRefined = false
    for (let tick = 0; tick < 400; tick++) {
      state = dispatchChain(state, [timeElapsed(T0 + tick * 5, 5)])
      const current = state.projects[0]!
      const req = current.requirements[0]!
      const refinable = current.tasks.filter((t) => !t.isReviewComment && taskNeedsRefinement(t))

      if (req.status !== 'open' && refinable.length > 0) {
        sawRefinableAfterReqRefined = true
        for (const task of refinable) {
          expect(task.status, `tick ${tick}`).not.toBe('pr_ready')
          expect(taskLifecycleLabel(task, current), `tick ${tick}`).toBe('refining')
        }
      }

      for (const task of current.tasks.filter((t) => !t.isReviewComment)) {
        if ((task.refinePassesRemaining ?? 0) > 0) {
          expect(task.status, `tick ${tick}`).not.toBe('pr_ready')
          expect(taskNeedsRefinement(task), `tick ${tick}`).toBe(true)
        }
      }
    }

    expect(sawRefinableAfterReqRefined).toBe(true)
    expect(state.projects[0]!.tasks.every((t) => !taskNeedsRefinement(t))).toBe(true)
  })
})
