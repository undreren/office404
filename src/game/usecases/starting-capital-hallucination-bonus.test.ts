import { describe, expect, it } from 'vitest'
import { PRESTIGE_START_CASH, startingCapitalBonus } from '../prestige'
import { createInitialState } from '../simulation/gameLogic'
import { createDefaultMeta } from '../meta'

describe('starting-capital-hallucination-bonus', () => {
  it('grants $2500 starting cash per starting_capital level on prestige runs', () => {
    const meta = {
      ...createDefaultMeta(),
      retirementCount: 1,
      hallucinationLevels: { starting_capital: 2 },
    }

    expect(startingCapitalBonus(meta)).toBe(5000)

    const state = createInitialState(1_000_000, 42, meta, { includeTutorial: false })
    expect(state.cash).toBe(PRESTIGE_START_CASH + 5000)
  })
})
