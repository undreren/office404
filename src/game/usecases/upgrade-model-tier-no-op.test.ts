import { describe, expect, it } from 'vitest'
import { upgradeModelTierMsg, stateChanged } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithCash } from './_helpers/stateWithCash'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('upgrade-model-tier-no-op', () => {
  it('matches use case invariants', () => {
    const before = stateWithCash(initialPlaying(), 200)
    expect(before.agents.length).toBeGreaterThan(0)

    const after = dispatchChain(before, [upgradeModelTierMsg(T0 + 1000)])

    expect(stateChanged(before, after)).toBe(false)
    expect(after.agents).toHaveLength(before.agents.length)
  })
})
