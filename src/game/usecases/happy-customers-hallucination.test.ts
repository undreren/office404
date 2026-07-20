import { describe, expect, it } from 'vitest'
import {
  effectiveMrr,
  hallucinationUpgradeCost,
  happyCustomersMrrMultiplier,
  HAPPY_CUSTOMERS_MAX_LEVEL,
} from '../prestige'
import { prestigeHallucinationBuyMsg } from '../messages'
import { createDefaultMeta } from '../meta'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('happy-customers-hallucination', () => {
  it('costs 1, 2, 3, 4, and 5 points per level', () => {
    expect(hallucinationUpgradeCost('happy_customers', 0)).toBe(1)
    expect(hallucinationUpgradeCost('happy_customers', 1)).toBe(2)
    expect(hallucinationUpgradeCost('happy_customers', 2)).toBe(3)
    expect(hallucinationUpgradeCost('happy_customers', 3)).toBe(4)
    expect(hallucinationUpgradeCost('happy_customers', 4)).toBe(5)
  })

  it('adds 25% effective MRR per level', () => {
    const meta = {
      ...createDefaultMeta(),
      hallucinationLevels: { happy_customers: 2 },
    }

    expect(happyCustomersMrrMultiplier(meta)).toBe(1.5)
    expect(effectiveMrr(100, meta)).toBe(150)
  })

  it('caps at five levels', () => {
    const meta = {
      ...createDefaultMeta(),
      hallucinationLevels: { happy_customers: HAPPY_CUSTOMERS_MAX_LEVEL + 2 },
    }

    expect(happyCustomersMrrMultiplier(meta)).toBe(1 + HAPPY_CUSTOMERS_MAX_LEVEL * 0.25)
  })

  it('can be purchased from the hallucination shop', () => {
    const before = {
      ...initialPlaying(),
      mrr: 80,
      meta: {
        ...initialPlaying().meta,
        hallucinationPoints: 5,
      },
    }

    const after = dispatchChain(before, [prestigeHallucinationBuyMsg(T0 + 1000, 'happy_customers')])

    expect(after.meta.hallucinationLevels.happy_customers).toBe(1)
    expect(effectiveMrr(after.mrr, after.meta)).toBe(100)
  })
})
