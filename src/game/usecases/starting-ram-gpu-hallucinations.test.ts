import { describe, expect, it } from 'vitest'
import { createInitialState, agentCapacity } from '../simulation/gameLogic'
import { createDefaultMeta, setHallucinationLevel } from '../meta'

describe('starting-ram-gpu-hallucinations', () => {
  it('seeds RAM and GPU purchases from prestige hallucinations on new runs', () => {
    let meta = createDefaultMeta()
    meta = setHallucinationLevel(meta, 'starting_ram', 2)
    meta = setHallucinationLevel(meta, 'starting_gpu', 1)

    const state = createInitialState(Date.now(), undefined, meta, { includeTutorial: false })

    expect(state.agentSlotPurchases).toBe(2)
    expect(state.gpuTickPurchases).toBe(1)
    expect(agentCapacity(state).agentSlots).toBe(3)
    expect(agentCapacity(state).gpuTicks).toBe(2)
  })

  it('does not apply starting hardware bonuses during the tutorial', () => {
    let meta = createDefaultMeta()
    meta = setHallucinationLevel(meta, 'starting_ram', 2)
    meta = setHallucinationLevel(meta, 'starting_gpu', 1)

    const state = createInitialState(Date.now(), undefined, meta, { includeTutorial: true })

    expect(state.agentSlotPurchases).toBe(0)
    expect(state.gpuTickPurchases).toBe(0)
  })
})
