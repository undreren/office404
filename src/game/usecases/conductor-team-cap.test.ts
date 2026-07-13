import { describe, expect, it } from 'vitest'
import { buyAgentSlotMsg, buyVibingCourseMsg, timeElapsed } from '../messages'
import { maxConductorTeamSize } from '../mechanics'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'
import type { Agent } from '../types'

describe('conductor-team-cap', () => {
  it('caps conductor project crew at three agents on tier 1', () => {
    expect(maxConductorTeamSize(1)).toBe(3)
    expect(maxConductorTeamSize(4)).toBe(6)
  })

  it('does not staff more than the conductor team cap', () => {
    let state = dispatchChain(stateWithCash(initialPlaying(), 10_000), [
      buyAgentSlotMsg(T0 + 100),
      buyAgentSlotMsg(T0 + 200),
      buyAgentSlotMsg(T0 + 300),
      buyVibingCourseMsg(T0 + 400, 'conductor'),
    ])

    const project = state.projects[0]!
    const conductor: Agent = {
      id: 'conductor-1',
      name: 'Conductor',
      personality: 'testy',
      job: 'conductor',
      projectId: project.id,
      taskId: null,
      status: 'conducting',
      contextUsed: 0,
      compactingRemainingSec: 0,
      jobProgress: 0,
      jobDuration: 0,
      uptime: 0,
      isAutomation: false,
    }
    const coders: Agent[] = ['coder-a', 'coder-b', 'coder-c', 'coder-d'].map((id) => ({
      id,
      name: id,
      personality: 'testy',
      job: 'code' as const,
      projectId: project.id,
      taskId: null,
      status: 'idle' as const,
      contextUsed: 0,
      compactingRemainingSec: 0,
      jobProgress: 0,
      jobDuration: 0,
      uptime: 0,
      isAutomation: false,
    }))

    state = {
      ...state,
      projects: [
        {
          ...project,
          useConductor: true,
          roleCounts: { refine: 0, code: 4, review: 0, test: 0, conductor: 1 },
          requirements: project.requirements.map((r) => ({ ...r, status: 'refined' as const })),
          tasks: project.tasks.map((t) => ({ ...t, status: 'open' as const, refined: true })),
        },
      ],
      agents: [conductor, ...coders],
    }

    const after = dispatchChain(state, [timeElapsed(T0 + 5000, 1)])

    const projectAgents = after.agents.filter((a) => a.projectId === project.id && a.job)
    expect(projectAgents.length).toBeLessThanOrEqual(3)
    expect(projectAgents.some((a) => a.job === 'conductor')).toBe(true)
  })
})
