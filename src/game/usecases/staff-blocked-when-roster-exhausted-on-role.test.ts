import { describe, expect, it } from 'vitest'
import { adjustRoleCountMsg, stateChanged } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateAtAgentCapacity } from './_helpers/stateAtAgentCapacity'
import { T0 } from './_helpers/testConstants'
import type { GameState } from '../types'

describe('staff-blocked-when-roster-exhausted-on-role', () => {
  it('does not inflate role counts when all agents are already on that role', () => {
    const base = stateAtAgentCapacity()
    const project = base.projects[0]!
    const before: GameState = {
      ...base,
      projects: [
        {
          ...project,
          roleCounts: { refine: 5, code: 0, review: 0, test: 0, conductor: 0 },
        },
      ],
      agents: base.agents.map((a) => ({
        ...a,
        job: 'refine' as const,
        projectId: project.id,
        status: 'idle' as const,
        taskId: null,
        jobProgress: 0,
        jobDuration: 0,
      })),
    }

    const after = dispatchChain(before, [adjustRoleCountMsg(T0 + 1000, project.id, 'refine', 1)])

    expect(stateChanged(before, after)).toBe(false)
    expect(after.projects[0]!.roleCounts.refine).toBe(5)
  })
})
