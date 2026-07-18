import { describe, expect, it } from 'vitest'
import { BASE_RAM_GB, RAM_PER_UPGRADE_GB, RAM_SLOT_BASE_COST } from '../constants'
import { ramSlotCost } from '../mechanics'
import { prestigeHallucinationBuyMsg } from '../messages'
import { createInitialState, agentCapacity } from '../simulation/gameLogic'
import { createDefaultMeta, setHallucinationLevel } from '../meta'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('starting-ram-gpu-hallucinations', () => {
  it('adds RAM and GPU from prestige hallucinations without counting as shop purchases', () => {
    let meta = createDefaultMeta()
    meta = setHallucinationLevel(meta, 'starting_ram', 2)
    meta = setHallucinationLevel(meta, 'starting_gpu', 1)

    const state = createInitialState(Date.now(), undefined, meta, { includeTutorial: false })

    expect(state.agentSlotPurchases).toBe(0)
    expect(state.gpuTickPurchases).toBe(0)
    expect(agentCapacity(state).agentSlots).toBe(BASE_RAM_GB + 2 * RAM_PER_UPGRADE_GB)
    expect(agentCapacity(state).gpuTicks).toBe(2)
    expect(ramSlotCost(state.agentSlotPurchases)).toBe(RAM_SLOT_BASE_COST)
  })

  it('does not apply starting hardware bonuses during the tutorial', () => {
    let meta = createDefaultMeta()
    meta = setHallucinationLevel(meta, 'starting_ram', 2)
    meta = setHallucinationLevel(meta, 'starting_gpu', 1)

    const state = createInitialState(Date.now(), undefined, meta, { includeTutorial: true })

    expect(state.agentSlotPurchases).toBe(0)
    expect(state.gpuTickPurchases).toBe(0)
    expect(agentCapacity(state).agentSlots).toBe(BASE_RAM_GB)
    expect(agentCapacity(state).gpuTicks).toBe(1)
  })

  it('grants RAM and GPU immediately when purchased mid-run without incrementing shop purchases', () => {
    const before = {
      ...initialPlaying(),
      tutorialDone: true,
      meta: {
        ...initialPlaying().meta,
        hallucinationPoints: 10,
      },
    }

    const withRam = dispatchChain(before, [prestigeHallucinationBuyMsg(T0 + 1000, 'starting_ram')])
    expect(withRam.agentSlotPurchases).toBe(0)
    expect(agentCapacity(withRam).agentSlots).toBe(BASE_RAM_GB + RAM_PER_UPGRADE_GB)
    expect(ramSlotCost(withRam.agentSlotPurchases)).toBe(RAM_SLOT_BASE_COST)

    const withGpu = dispatchChain(withRam, [prestigeHallucinationBuyMsg(T0 + 2000, 'starting_gpu')])
    expect(withGpu.gpuTickPurchases).toBe(0)
    expect(agentCapacity(withGpu).gpuTicks).toBe(2)
  })
})
