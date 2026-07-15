import { describe, expect, it } from 'vitest'
import { CLIENT_PAY_SP_EXPONENT } from '../constants'
import { clientPaymentForTotalSp } from '../mechanics'

describe('client-payment-flattens-with-sp', () => {
  it('uses sublinear scaling so dollars per SP drops as total SP grows', () => {
    const rep = 20
    const small = clientPaymentForTotalSp(8, rep)
    const large = clientPaymentForTotalSp(64, rep)
    const smallPerSp = small / 8
    const largePerSp = large / 64
    expect(large).toBeGreaterThan(small)
    expect(largePerSp).toBeLessThan(smallPerSp)
  })

  it('matches pow(sp, exponent) × rep multiplier at fixed reputation', () => {
    const rep = 10
    const sp = 13
    const repMult = 4 + rep * 0.3
    const expected = Math.round(Math.pow(sp, CLIENT_PAY_SP_EXPONENT) * repMult)
    expect(clientPaymentForTotalSp(sp, rep)).toBe(expected)
  })
})
