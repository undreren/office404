import { describe, expect, it } from 'vitest'
import { adjustRoleCountMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { GameState } from '../types'

describe('staff-code-pulls-idle-refine', () => {
  it('moves an idle refine agent to code without manually unstaffing refine', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const before: GameState = {
      ...base,
      projects: [
        {
          ...project,
          requirements: project.requirements.map((req) => ({ ...req, status: 'refined' as const })),
          roleCounts: { refine: 1, code: 0, review: 0, test: 0, conductor: 0 },
        },
      ],
      agents: base.agents.map((a) => ({
        ...a,
        job: 'refine' as const,
        projectId: project.id,
        status: 'idle' as const,
        taskId: null,
        contextUsed: 0,
        compactingRemainingSec: 0,
      })),
    }

    const state = dispatchChain(before, [adjustRoleCountMsg(T0 + 1000, project.id, 'code', 1)])

    expect(state.projects[0]!.roleCounts).toEqual({
      refine: 0,
      code: 1,
      review: 0,
      test: 0,
      conductor: 0,
    })
    expect(state.agents[0]!.job).toBe('code')
    expect(state.agents[0]!.projectId).toBe(project.id)
  })
})
