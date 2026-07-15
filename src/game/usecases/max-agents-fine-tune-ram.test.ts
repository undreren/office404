import { describe, expect, it } from 'vitest'
import { fineTuneId } from '../models'
import { agentCapacity } from '../simulation/gameLogic'
import {
  agentRamGb,
  canFitAgentRam,
  maxAgents,
  rosterParamsForAgent,
  spawnAgentRamGb,
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

describe('max-agents-fine-tune-ram', () => {
  it('counts max agents using fine-tuned spawn RAM, not base model params', () => {
    const state = stateWithHeavyFineTunes(16, 11)
    const spawnRam = spawnAgentRamGb(state)
    const baseOnly = agentRamGb(4)

    expect(spawnRam).toBeGreaterThan(baseOnly * 3)
    expect(maxAgents(state)).toBeLessThan(20)
    expect(agentCapacity(state).max).toBe(maxAgents(state))
  })

  it('blocks spawning when fine-tuned agents fill RAM even if base-param math would allow more', () => {
    const state = stateWithHeavyFineTunes(16, 11)
    const total = totalRamGb(state)
    const used = state.agents.reduce(
      (sum, agent) => sum + agentRamGb(rosterParamsForAgent(state, agent)),
      0,
    )
    const spawnRam = spawnAgentRamGb(state)

    expect(used + spawnRam).toBeGreaterThan(total)
    expect(
      canFitAgentRam(state, spawnRam, (agent) => rosterParamsForAgent(state, agent)),
    ).toBe(false)
    expect(state.agents.length).toBeGreaterThan(maxAgents(state) - 5)
  })
})
