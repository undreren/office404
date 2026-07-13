import { describe, expect, it } from 'vitest'
import { reviewCommentSpawnCount } from '../mechanics'
import { Rng } from '../rng'

describe('review-hallucination-fewer-comments', () => {
  it('subtracts one comment per review hallucination level', () => {
    const rng = new Rng(42)
    const base = reviewCommentSpawnCount(rng, 13, 0)
    expect(base).toBeGreaterThanOrEqual(1)

    const rng2 = new Rng(42)
    expect(reviewCommentSpawnCount(rng2, 13, 1)).toBe(Math.max(0, base - 1))
  })

  it('can spawn zero comments at level 4', () => {
    const rng = new Rng(1)
    expect(reviewCommentSpawnCount(rng, 13, 4)).toBe(0)
  })
})
