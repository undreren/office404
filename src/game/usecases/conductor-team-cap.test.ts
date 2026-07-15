import { describe, expect, it } from 'vitest'
import { buyAgentSlotMsg, buyVibingCourseMsg, timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'
import type { Agent } from '../types'

describe('conductor-team-cap', () => {
  it('staffs beyond the old tier-1 cap of three when roster allows', () => {
    let state = dispatchChain(stateWithCash(initialPlaying(), 100_000), [
      ...Array.from({ length: 8 }, (_, i) => buyAgentSlotMsg(T0 + 100 + i * 10)),
      buyVibingCourseMsg(T0 + 500, 'conductor'),
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

    state = {
      ...state,
      projects: [
        {
          ...project,
          useConductor: true,
          roleCounts: { refine: 0, code: 0, review: 0, test: 0, conductor: 1 },
          requirements: project.requirements.map((r) => ({ ...r, status: 'open' as const })),
          tasks: [],
        },
      ],
      agents: [conductor],
    }

    const after = dispatchChain(state, [timeElapsed(T0 + 5000, 5)])

    const projectAgents = after.agents.filter((a) => a.projectId === project.id && a.job)
    expect(projectAgents.length).toBeGreaterThan(3)
    expect(projectAgents.some((a) => a.job === 'conductor')).toBe(true)
  })

  it('allows only one conductor course purchase', () => {
    const state = dispatchChain(stateWithCash(initialPlaying(), 100_000), [
      buyVibingCourseMsg(T0 + 100, 'conductor'),
      buyVibingCourseMsg(T0 + 200, 'conductor'),
    ])

    expect(state.vibingCourses).toEqual(['conductor'])
    expect(state.vibingCourseTiers.conductor).toBe(1)
  })
})
