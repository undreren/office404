import { describe, expect, it } from 'vitest'
import { timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { GameState } from '../types'

describe('reconcile-trims-excess-agents', () => {
  it('pulls busy agents off a project when role counts drop below staffed agents', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const before: GameState = {
      ...base,
      projects: [
        {
          ...project,
          roleCounts: { refine: 0, code: 0, review: 0, test: 0, conductor: 0 },
        },
      ],
      agents: base.agents.map((a) => ({
        ...a,
        job: 'refine' as const,
        projectId: project.id,
        status: 'refining' as const,
        taskId: project.requirements[0]!.id,
        jobProgress: 0.5,
        jobDuration: 4,
        contextUsed: 0,
        compactingRemainingSec: 0,
      })),
    }

    const state = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    expect(state.projects[0]!.roleCounts.refine).toBe(0)
    expect(state.agents.filter((a) => a.projectId === project.id && a.job === 'refine')).toHaveLength(0)
    expect(state.projects[0]!.requirements[0]!.refineJobProgress).toBe(0.5)
  })
})
