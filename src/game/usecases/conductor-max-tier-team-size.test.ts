import { describe, expect, it } from 'vitest'
import { buyVibingCourseMsg, timeElapsed } from '../messages'
import { maxConductorTeamSize } from '../mechanics'
import { CONDUCTOR_MAX_TIER } from '../upgrades'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'
import type { Agent } from '../types'

describe('conductor-max-tier-team-size', () => {
  it('staffs up to maxConductorTeamSize agents at max conductor tier', () => {
    expect(maxConductorTeamSize(CONDUCTOR_MAX_TIER)).toBe(6)

    let state = dispatchChain(stateWithCash(initialPlaying(), 100_000), 
      Array.from({ length: CONDUCTOR_MAX_TIER }, (_, i) =>
        buyVibingCourseMsg(T0 + 2000 + i * 100, 'conductor'),
      ),
    )
    state = { ...state, agentSlotPurchases: 10 }

    expect(state.vibingCourseTiers.conductor).toBe(CONDUCTOR_MAX_TIER)

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
    expect(projectAgents.length).toBe(6)
  })
})
