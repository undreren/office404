import { describe, expect, it } from 'vitest'
import { maxRequirementSpForReputation } from '../mechanics'
import { decomposeTotalSp } from '../projects'

describe('refine-hallucination-chunk-cap', () => {
  it('widens the rep divisor per refine hallucination level', () => {
    expect(maxRequirementSpForReputation(100, 0)).toBe(21)
    expect(maxRequirementSpForReputation(100, 2)).toBe(7)
    expect(maxRequirementSpForReputation(100, 4)).toBe(5)
  })

  it('still reaches 89 SP chunks at extreme rep on high refine levels', () => {
    expect(maxRequirementSpForReputation(2200, 4)).toBe(89)
  })

  it('decomposes client projects into finer requirements', () => {
    const vanilla = decomposeTotalSp(40, maxRequirementSpForReputation(50, 0))
    const refined = decomposeTotalSp(40, maxRequirementSpForReputation(50, 4))
    expect(refined.length).toBeGreaterThan(vanilla.length)
    expect(refined.every((p) => p <= maxRequirementSpForReputation(50, 4))).toBe(true)
    expect(refined.reduce((s, p) => s + p, 0)).toBe(40)
  })
})
