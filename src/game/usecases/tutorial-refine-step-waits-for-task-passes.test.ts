import { describe, expect, it } from 'vitest'
import { getTutorialStep } from '../onboarding'
import { refineRequirementToTasks } from '../projects'
import { ctxFrom } from '../simulation/simCtx'
import type { GameState, Requirement } from '../types'
import { initialPlaying } from './_helpers/initialPlaying'

describe('tutorial-refine-step-waits-for-task-passes', () => {
  it('stays on refine step while tasks still have refine passes', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const ctx = ctxFrom({ ...base, vibingCourseTiers: { refinement: 2 } } as GameState)

    const refinedRequirements = project.requirements.map((req) => {
      const tasks = refineRequirementToTasks(ctx, req, { refinementTier: 2 })
      const status = tasks.length > 1 ? ('split' as const) : ('refined' as const)
      return { requirement: { ...req, status }, tasks }
    })

    const state: GameState = {
      ...base,
      vibingCourseTiers: { refinement: 2 },
      projects: [
        {
          ...project,
          requirements: refinedRequirements.map((entry) => entry.requirement),
          tasks: refinedRequirements.flatMap((entry) => entry.tasks),
        },
      ],
    }

    const stillRefining = state.projects[0]!.tasks.some(
      (t) => !t.isReviewComment && (t.refinePassesRemaining ?? 0) > 0,
    )
    expect(stillRefining).toBe(true)
    expect(state.projects[0]!.tasks.every((t) => (t.refinePassesRemaining ?? 0) > 0 ? !t.refined : t.refined)).toBe(
      true,
    )
    expect(getTutorialStep(state)).toBe(0)
  })

  it('stays on refine step for a single refined requirement with pending task passes', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const requirement: Requirement = {
      id: 'req-1',
      projectId: project.id,
      title: 'Tiny',
      storyPoints: 1,
      status: 'refined',
      refinePassesUsed: 0,
    }
    const ctx = ctxFrom({ ...base, vibingCourseTiers: { refinement: 2 } } as GameState)
    const [task] = refineRequirementToTasks(ctx, { ...requirement, status: 'open' }, { refinementTier: 2 })

    const state: GameState = {
      ...base,
      vibingCourseTiers: { refinement: 2 },
      projects: [
        {
          ...project,
          requirements: [requirement],
          tasks: [task!],
        },
      ],
    }

    expect((task!.refinePassesRemaining ?? 0) > 0).toBe(true)
    expect(getTutorialStep(state)).toBe(0)
  })
})
