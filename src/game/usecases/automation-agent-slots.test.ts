import { describe, expect, it } from 'vitest'
import {
  assignAutomationAgentMsg,
  buyAgentSlotMsg,
  buyVibingCourseMsg,
  setAutomationAgentActiveMsg,
  stateChanged,
  timeElapsed,
} from '../messages'
import { agentCapacity } from '../simulation/gameLogic'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'
import type { Agent, GameState } from '../types'

describe('automation-agent-slots', () => {
  it('spawns an automation agent that occupies a roster slot when capacity allows', () => {
    const before = stateWithCash(initialPlaying(), 500)
    const withSlot = dispatchChain(before, [buyAgentSlotMsg(T0 + 500)])
    const slotsBefore = agentCapacity(withSlot)

    const state = dispatchChain(withSlot, [buyVibingCourseMsg(T0 + 1000, 'marketing')])

    expect(state.agents.some((a) => a.isAutomation && a.automationJob === 'marketing')).toBe(true)
    expect(agentCapacity(state).used).toBe(slotsBefore.used + 1)
  })

  it('defers specialist spawn when the roster is full at unlock', () => {
    const before = stateWithCash(initialPlaying(), 350)

    const state = dispatchChain(before, [buyVibingCourseMsg(T0 + 1000, 'marketing')])

    expect(state.agents.some((a) => a.isAutomation && a.automationJob === 'marketing')).toBe(false)
    expect(agentCapacity(state).used).toBe(agentCapacity(before).used)
  })

  it('materializes a deferred specialist when a new roster slot opens', () => {
    const before = stateWithCash(initialPlaying(), 500)
    const unlocked = dispatchChain(before, [buyVibingCourseMsg(T0 + 1000, 'marketing')])
    expect(unlocked.agents.some((a) => a.automationJob === 'marketing')).toBe(false)

    const withSlot = dispatchChain(unlocked, [buyAgentSlotMsg(T0 + 1500)])

    expect(withSlot.agents.some((a) => a.isAutomation && a.automationJob === 'marketing')).toBe(true)
    expect(agentCapacity(withSlot).used).toBe(2)
  })

  it('assigns a deferred specialist from the status action when roster space is available', () => {
    const before = stateWithCash(initialPlaying(), 350)
    const unlocked = dispatchChain(before, [buyVibingCourseMsg(T0 + 1000, 'marketing')])
    const spareCapacity: GameState = {
      ...unlocked,
      agentSlotPurchases: 1,
    }

    const assigned = dispatchChain(spareCapacity, [assignAutomationAgentMsg(T0 + 2000, 'marketing')])

    expect(assigned.agents.some((a) => a.isAutomation && a.automationJob === 'marketing')).toBe(true)
    expect(agentCapacity(assigned).used).toBe(2)
  })

  it('blocks assigning a specialist when the roster is full', () => {
    const before = stateWithCash(initialPlaying(), 350)
    const unlocked = dispatchChain(before, [buyVibingCourseMsg(T0 + 1000, 'marketing')])

    const blocked = dispatchChain(unlocked, [assignAutomationAgentMsg(T0 + 2000, 'marketing')])

    expect(stateChanged(unlocked, blocked)).toBe(false)
  })

  it('benches an automation agent from the status action without freeing the roster slot', () => {
    const before = stateWithCash(initialPlaying(), 500)
    const withSlot = dispatchChain(before, [buyAgentSlotMsg(T0 + 500)])
    const withMarketing = dispatchChain(withSlot, [buyVibingCourseMsg(T0 + 1000, 'marketing')])
    const marketingAgent = withMarketing.agents.find((a) => a.automationJob === 'marketing')!
    const usedBefore = agentCapacity(withMarketing).used

    const benched = dispatchChain(withMarketing, [
      setAutomationAgentActiveMsg(T0 + 2000, marketingAgent.id, false),
    ])
    const benchedAgent = benched.agents.find((a) => a.id === marketingAgent.id)!

    expect(benchedAgent.job).toBeNull()
    expect(agentCapacity(benched).used).toBe(usedBefore)
  })

  it('does not let conductor pull a benched automation agent onto project work', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const template = base.agents[0]!
    const marketingAgent: Agent = {
      ...template,
      id: 'marketing-1',
      isAutomation: true,
      automationJob: 'marketing',
      job: null,
      projectId: null,
      status: 'idle',
      taskId: null,
      contextUsed: 0,
      compactingRemainingSec: 0,
    }

    const before: GameState = {
      ...base,
      vibingCourses: ['conductor', 'marketing'],
      projects: [
        {
          ...project,
          useConductor: true,
          roleCounts: { refine: 1, code: 0, review: 0, test: 0, conductor: 1 },
        },
      ],
      agents: [
        {
          ...template,
          id: 'conductor-1',
          job: 'conductor',
          projectId: project.id,
          status: 'conducting',
          taskId: null,
          contextUsed: 0,
          compactingRemainingSec: 0,
        },
        marketingAgent,
      ],
    }

    const state = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    expect(state.agents.find((a) => a.id === marketingAgent.id)?.job).toBeNull()
    expect(state.agents.some((a) => a.projectId === project.id && a.job === 'refine')).toBe(false)
  })

  it('pauses procurement automation when the procurement agent is benched', () => {
    const before = stateWithCash(initialPlaying(), 5000)
    const withSlot = dispatchChain(before, [buyAgentSlotMsg(T0 + 500)])
    const withProcurement = dispatchChain(withSlot, [buyVibingCourseMsg(T0 + 1000, 'procurement')])
    const procurementAgent = withProcurement.agents.find((a) => a.automationJob === 'procurement')!
    const slotsBefore = withProcurement.agentSlotPurchases

    const benched = dispatchChain(withProcurement, [
      setAutomationAgentActiveMsg(T0 + 2000, procurementAgent.id, false),
      timeElapsed(T0 + 3000, 60),
    ])

    expect(benched.agentSlotPurchases).toBe(slotsBefore)
  })
})
