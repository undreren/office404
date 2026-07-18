import { describe, expect, it } from 'vitest'
import { FIBONACCI } from '../mechanics'
import { nextProductFeatureSp } from '../product'

describe('product-feature-scaling', () => {
  it('follows the Fibonacci ladder for early features', () => {
    for (let shipped = 0; shipped < FIBONACCI.length; shipped++) {
      expect(nextProductFeatureSp(shipped)).toBe(FIBONACCI[shipped])
    }
  })

  it('adds a fixed increment per feature after the Fibonacci ladder instead of exponential growth', () => {
    expect(nextProductFeatureSp(11)).toBe(102) // 89 + 1×13
    expect(nextProductFeatureSp(15)).toBe(154) // 89 + 5×13
    expect(nextProductFeatureSp(20)).toBe(219) // 89 + 10×13
  })
})
