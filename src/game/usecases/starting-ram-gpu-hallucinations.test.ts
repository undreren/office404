import { describe, expect, it } from 'vitest'
import { BASE_RAM_GB, RAM_PER_UPGRADE_GB } from '../constants'
import { prestigeHallucinationBuyMsg } from '../messages'
import { createInitialState, agentCapacity } from '../simulation/gameLogic'
import { createDefaultMeta, setHallucinationLevel } from '../meta'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('starting-ram-gpu-hallucinations', () => {
  it('seeds RAM and GPU purchases from prestige hallucinations on new runs', () => {
    let meta = createDefaultMeta()
    meta = setHallucinationLevel(meta, 'starting_ram', 2)
    meta = setHallucinationLevel(meta, 'starting_gpu', 1)

    const state = createInitialState(Date.now(), undefined, meta, { includeTutorial: false })

    expect(state.agentSlotPurchases).toBe(2)
    expect(state.gpuTickPurchases).toBe(1)
    expect(agentCapacity(state).agentSlots).toBe(BASE_RAM_GB + 2 * RAM_PER_UPGRADE_GB)
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

  it('grants RAM and GPU immediately when purchased mid-run', () => {
    const before = {
      ...initialPlaying(),
      meta: {
        ...initialPlaying().meta,
        hallucinationPoints: 10,
      },
    }

    const withRam = dispatchChain(before, [prestigeHallucinationBuyMsg(T0 + 1000, 'starting_ram')])
    expect(withRam.agentSlotPurchases).toBe(1)
    expect(agentCapacity(withRam).agentSlots).toBe(BASE_RAM_GB + RAM_PER_UPGRADE_GB)

    const withGpu = dispatchChain(withRam, [prestigeHallucinationBuyMsg(T0 + 2000, 'starting_gpu')])
    expect(withGpu.gpuTickPurchases).toBe(1)
    expect(agentCapacity(withGpu).gpuTicks).toBe(2)
  })
})
