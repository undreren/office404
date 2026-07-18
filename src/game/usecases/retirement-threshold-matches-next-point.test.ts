import { describe, expect, it } from 'vitest'
import {
  canRetire,
  hallucinationPointsFromRetirement,
  nextHallucinationPointCashThreshold,
  rungCashThreshold,
} from '../prestige'
import { retireMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'

describe('retirement-threshold-matches-next-point', () => {
  it('uses the next unclaimed ladder rung, not retirement count', () => {
    const overshot = {
      ...initialPlaying(),
      meta: {
        ...initialPlaying().meta,
        retirementCount: 1,
        highestRungEver: 2,
      },
    }

    expect(nextHallucinationPointCashThreshold(2)).toBe(rungCashThreshold(3))
    expect(canRetire(1_100_000, 2)).toBe(false)
    expect(canRetire(rungCashThreshold(3), 2)).toBe(true)
    expect(hallucinationPointsFromRetirement(rungCashThreshold(3), 2)).toBe(1)

    const blocked = dispatchChain(overshot, [retireMsg(T0 + 1000)])
    expect(blocked.meta.retirementCount).toBe(1)
  })

  it('grants a point when retiring at the displayed threshold', () => {
    const before = stateWithCash(initialPlaying(), rungCashThreshold(1))
    expect(canRetire(before.cash, before.meta.highestRungEver)).toBe(true)

    const after = dispatchChain(before, [retireMsg(T0 + 1000)])
    expect(after.meta.hallucinationPoints).toBeGreaterThan(0)
  })
})
