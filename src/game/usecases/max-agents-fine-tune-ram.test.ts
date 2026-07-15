import { describe, expect, it } from 'vitest'
import { fineTuneId } from '../models'
import { agentCapacity } from '../simulation/gameLogic'
import {
  canFitAgentRam,
  getAgentRamParams,
  getAgentParameters,
  maxAgents,
  totalRamGb,
} from '../mechanics'
import { initialPlaying } from './_helpers/initialPlaying'
import type { Agent, GameState } from '../types'

function stateWithHeavyFineTunes(agentSlotPurchases: number, agentCount: number): GameState {
  const base = initialPlaying()
  const tuneId = fineTuneId(0, 'code')
  const tier = 13
  const starter = base.agents[0]!
  const agents: Agent[] = Array.from({ length: agentCount }, (_, i) => ({
    ...starter,
    id: `agt-ram-${i}`,
    name: `Coder ${i}`,
    job: 'code',
    projectId: i === 0 ? base.projects[0]!.id : null,
    taskId: null,
    status: i === 0 ? 'working' : 'idle',
    contextUsed: 0,
    compactingRemainingSec: 0,
    jobProgress: 0,
    jobDuration: 0,
  }))
  return {
    ...base,
    agentSlotPurchases,
    purchasedFineTunes: [tuneId],
    fineTuneTiers: { [tuneId]: tier },
    agents,
  }
}

describe('agent-ram-excludes-fine-tunes', () => {
  it('uses model size for RAM, not cash fine-tune multipliers', () => {
    const state = stateWithHeavyFineTunes(16, 11)
    const ramParams = getAgentRamParams(state.meta)
    const effective = getAgentParameters(
      state.meta,
      state.purchasedFineTunes,
      'code',
      0,
      state.fineTuneTiers,
    )

    expect(ramParams).toBe(4)
    expect(effective).toBeGreaterThan(ramParams * 3)
    expect(maxAgents(state)).toBe(
      state.agents.length +
        Math.floor((totalRamGb(state) - state.agents.length * ramParams) / ramParams),
    )
    expect(agentCapacity(state).max).toBe(maxAgents(state))
  })

  it('still allows spawning when fine-tunes inflate effective params but not RAM', () => {
    const state = stateWithHeavyFineTunes(16, 11)
    const perAgent = getAgentRamParams(state.meta)

    expect(
      canFitAgentRam(state, perAgent, () => perAgent),
    ).toBe(true)
  })
})
