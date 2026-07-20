import { describe, expect, it } from 'vitest'
import { buyVibingCourseMsg, timeElapsed } from '../messages'
import {
  refineRequirementToTasks,
  taskLifecycleLabel,
  taskNeedsRefinement,
} from '../projects'
import { ctxFrom } from '../simulation/simCtx'
import type { Agent, GameState } from '../types'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('refine-task-mid-pipeline-simulation', () => {
  it('does not mark child tasks complete when they still have refine passes', () => {
    const base = initialPlaying(42)
    const project = base.projects[0]!
    const template = base.agents[0]!
    const requirement = project.requirements.find((r) => r.storyPoints >= 2)!
    const ctx = ctxFrom({ ...base, vibingCourseTiers: { refinement: 2 } } as GameState)
    const firstPassTasks = refineRequirementToTasks(ctx, requirement, { refinementTier: 2 })

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
          requirements: project.requirements.map((r) =>
            r.id === requirement.id ? { ...r, status: 'split' as const } : r,
          ),
          tasks: firstPassTasks,
          roleCounts: { refine: 1, code: 0, review: 0, test: 0, conductor: 0 },
        },
      ],
    }

    state = dispatchChain(state, [
      buyVibingCourseMsg(T0, 'refinement'),
      buyVibingCourseMsg(T0 + 1, 'refinement'),
    ])

    let snapshot: GameState | null = null
    for (let tick = 0; tick < 400; tick++) {
      const beforeCount = state.projects[0]!.tasks.length
      state = dispatchChain(state, [timeElapsed(T0 + tick * 5, 5)])
      const afterCount = state.projects[0]!.tasks.length
      if (afterCount > beforeCount) {
        snapshot = state
        break
      }
    }

    expect(snapshot).not.toBeNull()
    const current = snapshot!.projects[0]!
    const refinable = current.tasks.filter((t) => !t.isReviewComment && taskNeedsRefinement(t))
    expect(refinable.length).toBeGreaterThan(0)
    for (const task of refinable) {
      expect(task.status).not.toBe('pr_ready')
      expect(task.status).not.toBe('done')
      expect(task.status).not.toBe('merged')
      expect(taskLifecycleLabel(task, current)).toBe('refining')
    }
  })
})
