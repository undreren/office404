import { describe, expect, it } from 'vitest'
import { activateProductFeatureMsg, prestigeHallucinationBuyMsg } from '../messages'
import { countActiveProductProjects } from '../product'
import { maxProductProjectSlots } from '../prestige'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('in-house-multi-slot-backlog', () => {
  function withInHouseLevel(level: number) {
    return {
      ...initialPlaying(),
      meta: {
        ...initialPlaying().meta,
        hallucinationPoints: 50,
        hallucinationLevels: { in_house: level },
      },
    }
  }

  it('seeds one queued backlog item per open product slot after unlocking in_house', () => {
    const state = dispatchChain(withInHouseLevel(0), [
      prestigeHallucinationBuyMsg(T0 + 1000, 'in_house'),
      prestigeHallucinationBuyMsg(T0 + 2000, 'in_house'),
    ])

    expect(maxProductProjectSlots(state.meta)).toBe(2)
    expect(state.productBacklog.filter((item) => item.status === 'queued')).toHaveLength(2)
  })

  it('replenishes backlog after starting a feature so the second slot can be filled', () => {
    const unlocked = dispatchChain(withInHouseLevel(0), [
      prestigeHallucinationBuyMsg(T0 + 1000, 'in_house'),
      prestigeHallucinationBuyMsg(T0 + 2000, 'in_house'),
    ])
    const queued = unlocked.productBacklog.find((item) => item.status === 'queued')
    expect(queued).toBeDefined()

    const state = dispatchChain(unlocked, [activateProductFeatureMsg(T0 + 3000, queued!.id)])

    expect(countActiveProductProjects(state.projects)).toBe(1)
    expect(state.productBacklog.filter((item) => item.status === 'queued')).toHaveLength(1)
  })
})
