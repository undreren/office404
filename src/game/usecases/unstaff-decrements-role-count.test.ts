import { describe, expect, it } from 'vitest'
import { adjustRoleCountMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { GameState } from '../types'

describe('unstaff-decrements-role-count', () => {
  it('reduces desired role count even when no agent is currently assigned', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const before: GameState = {
      ...base,
      projects: [
        {
          ...project,
          roleCounts: { refine: 2, code: 0, review: 0, test: 0, conductor: 0 },
        },
      ],
      agents: base.agents.map((a) => ({
        ...a,
        job: null,
        projectId: null,
        status: 'idle' as const,
        taskId: null,
      })),
    }

    const state = dispatchChain(before, [adjustRoleCountMsg(T0 + 1000, project.id, 'refine', -1)])

    expect(state.projects[0]!.roleCounts.refine).toBe(1)
    expect(state.agents.filter((a) => a.job === 'refine')).toHaveLength(0)
  })
})
