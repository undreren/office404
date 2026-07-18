import { describe, expect, it } from 'vitest'
import { STARTING_CAPITAL_BONUS_PER_LEVEL } from '../constants'
import { PRESTIGE_START_CASH, startingCapitalBonus } from '../prestige'
import { prestigeHallucinationBuyMsg } from '../messages'
import { createInitialState } from '../simulation/gameLogic'
import { createDefaultMeta } from '../meta'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('starting-capital-hallucination-bonus', () => {
  it('grants starting cash per starting_capital level on prestige runs', () => {
    const meta = {
      ...createDefaultMeta(),
      retirementCount: 1,
      hallucinationLevels: { starting_capital: 2 },
    }

    expect(startingCapitalBonus(meta)).toBe(STARTING_CAPITAL_BONUS_PER_LEVEL * 2)

    const state = createInitialState(1_000_000, 42, meta, { includeTutorial: false })
    expect(state.cash).toBe(PRESTIGE_START_CASH + STARTING_CAPITAL_BONUS_PER_LEVEL * 2)
  })

  it('grants cash immediately when purchased mid-run', () => {
    const before = {
      ...initialPlaying(),
      cash: 500,
      meta: {
        ...initialPlaying().meta,
        hallucinationPoints: 5,
      },
    }

    const after = dispatchChain(before, [prestigeHallucinationBuyMsg(T0 + 1000, 'starting_capital')])

    expect(after.cash).toBe(500 + STARTING_CAPITAL_BONUS_PER_LEVEL)
    expect(after.meta.hallucinationLevels.starting_capital).toBe(1)
  })
})
