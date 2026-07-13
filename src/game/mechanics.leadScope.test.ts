import { describe, expect, it } from 'vitest'
import { leadScopeForReputation, maxRequirementSpForReputation, pickLeadTotalStoryPoints } from './mechanics'
import { decomposeTotalSp } from './projects'
import { Rng } from './rng'

describe('leadScopeForReputation', () => {
  it('stays tiny at low rep', () => {
    const { minTotal, maxTotal } = leadScopeForReputation(0)
    expect(minTotal).toBe(3)
    expect(maxTotal).toBe(5)
  })

  it('ramps slowly through mid rep', () => {
    const at10 = leadScopeForReputation(10)
    expect(at10.minTotal).toBe(5)
    expect(at10.maxTotal).toBe(8)

    const at20 = leadScopeForReputation(20)
    expect(at20.minTotal).toBe(8)
    expect(at20.maxTotal).toBe(13)
  })

  it('ignores game day — same rep always same bounds', () => {
    expect(leadScopeForReputation(5)).toEqual(leadScopeForReputation(5))
  })
})

describe('pickLeadTotalStoryPoints', () => {
  it('rolls within rep-only bounds', () => {
    const rng = new Rng(99)
    const { minTotal, maxTotal } = leadScopeForReputation(0)
    for (let i = 0; i < 20; i++) {
      const sp = pickLeadTotalStoryPoints(rng, 0)
      expect(sp).toBeGreaterThanOrEqual(minTotal)
      expect(sp).toBeLessThanOrEqual(maxTotal)
    }
  })
})

describe('maxRequirementSpForReputation', () => {
  it('caps early requirement chunks', () => {
    expect(maxRequirementSpForReputation(0)).toBe(1)
    expect(maxRequirementSpForReputation(10)).toBe(3)
    expect(maxRequirementSpForReputation(20)).toBe(5)
  })
})

describe('decomposeTotalSp with rep cap', () => {
  it('never emits chunks above the rep cap', () => {
    const cap = maxRequirementSpForReputation(0)
    const parts = decomposeTotalSp(5, cap)
    expect(parts.every((p) => p <= cap)).toBe(true)
    expect(parts.reduce((s, p) => s + p, 0)).toBe(5)
  })
})
