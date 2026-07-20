import { describe, expect, it } from 'vitest'
import { SECONDS_PER_GAME_DAY } from '../constants'
import { setHallucinationLevel } from '../meta'
import { timeElapsed } from '../messages'
import { hallucinationUpgradeCost, timeDistillationMultiplier } from '../prestige'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('time-distillation', () => {
  it('costs 2, 4, 8, 16, and 32 for levels 1 through 5', () => {
    expect(hallucinationUpgradeCost('time_distillation', 0)).toBe(2)
    expect(hallucinationUpgradeCost('time_distillation', 1)).toBe(4)
    expect(hallucinationUpgradeCost('time_distillation', 2)).toBe(8)
    expect(hallucinationUpgradeCost('time_distillation', 3)).toBe(16)
    expect(hallucinationUpgradeCost('time_distillation', 4)).toBe(32)
  })

  it('adds +1 to the time speed multiplier per level', () => {
    const meta = setHallucinationLevel(initialPlaying().meta, 'time_distillation', 3)
    expect(timeDistillationMultiplier(meta)).toBe(4)
  })

  it('advances game days faster when levels are owned', () => {
    const before = initialPlaying()
    const distilled = {
      ...before,
      meta: setHallucinationLevel(before.meta, 'time_distillation', 2),
    }
    const base = dispatchChain(before, [timeElapsed(T0 + 1000, SECONDS_PER_GAME_DAY)])
    const fast = dispatchChain(distilled, [timeElapsed(T0 + 1000, SECONDS_PER_GAME_DAY)])

    expect(base.gameDay - before.gameDay).toBeCloseTo(1, 5)
    expect(fast.gameDay - distilled.gameDay).toBeCloseTo(3, 5)
  })
})
