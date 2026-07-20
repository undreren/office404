import { describe, expect, it } from 'vitest'
import { RENT_INTERVAL_DAYS } from '../constants'
import { effectiveHousingRent, effectiveHousingUpgradeCost, housingCostMultiplier } from '../housing'
import { createDefaultMeta, setHallucinationLevel } from '../meta'
import { AFFORDABLE_HOUSING_MAX_LEVEL, hallucinationUpgradeCost } from '../prestige'
import { advanceGameDays } from './_helpers/advanceGameDays'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'

describe('affordable-housing-hallucination', () => {
  it('charges 1 through 9 points for levels 0–8', () => {
    for (let level = 0; level < AFFORDABLE_HOUSING_MAX_LEVEL; level++) {
      expect(hallucinationUpgradeCost('affordable_housing', level)).toBe(level + 1)
    }
  })

  it('reduces housing costs by 10% per level', () => {
    expect(housingCostMultiplier(0)).toBe(1)
    expect(housingCostMultiplier(3)).toBeCloseTo(0.7)
    expect(housingCostMultiplier(9)).toBeCloseTo(0.1)
    expect(housingCostMultiplier(12)).toBeCloseTo(0.1)
  })

  it('applies discount to rent and move-in costs', () => {
    expect(effectiveHousingRent('cardboard', 2)).toBe(32)
    expect(effectiveHousingUpgradeCost('shared_1br', 2)).toBe(80)
  })

  it('deducts discounted rent on due date', () => {
    const meta = setHallucinationLevel(createDefaultMeta(), 'affordable_housing', 2)
    const before = stateWithCash({ ...initialPlaying(), meta }, 100)
    const state = advanceGameDays(before, RENT_INTERVAL_DAYS, T0 + 10_000)

    expect(state.cash).toBe(100 - effectiveHousingRent('cardboard', 2))
  })
})
