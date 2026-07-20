import { describe, expect, it } from 'vitest'
import { applyOfflineProgressMsg, buyVibingCourseMsg, timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'

function enrolledBase() {
  return dispatchChain(stateWithCash(initialPlaying(), 2000), [buyVibingCourseMsg(T0 + 500, 'offline')])
}

describe('offline-catchup-rent-parity', () => {
  it.each([60, 300, 3600, 8 * 60 * 60])(
    'matches tick-by-tick cash and gameDay after %i seconds away',
    (awaySec) => {
      const before = enrolledBase()

      const live = dispatchChain(
        before,
        Array.from({ length: awaySec }, (_, i) => timeElapsed(T0 + 1000 + i, 1)),
      )
      const offline = dispatchChain(before, [applyOfflineProgressMsg(T0 + awaySec * 1000, awaySec)])

      expect(offline.gameDay).toBeCloseTo(live.gameDay, 4)
      expect(offline.cash).toBeCloseTo(live.cash, 4)
      expect(offline.rentDueInDays).toBeCloseTo(live.rentDueInDays, 4)
    },
  )
})
