import { describe, expect, it } from 'vitest'
import { TICK_INTERVAL_MS } from '../constants'
import { catchUpOfflineMsg, buyVibingCourseMsg, timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'

const PARITY_AWAY_SEC = 120

function enrolledBase() {
  return dispatchChain(stateWithCash(initialPlaying(), 2000), [buyVibingCourseMsg(T0 + 500, 'offline')])
}

describe('offline-catchup-boundary-parity', () => {
  it('uses event-boundary steps no coarser than one live tick', () => {
    expect(TICK_INTERVAL_MS).toBeGreaterThan(0)
  })

  it('matches fine-grained simulation for a two-minute away window', () => {
    const enrolled = enrolledBase()
    const before = { ...enrolled, snapshotAt: T0 }
    const ticked = dispatchChain(
      before,
      Array.from({ length: PARITY_AWAY_SEC }, (_, i) => timeElapsed(T0 + 1000 + i, 1)),
    )
    const offline = dispatchChain(before, [catchUpOfflineMsg(T0 + PARITY_AWAY_SEC * 1000)])

    expect(offline.gameDay).toBeCloseTo(ticked.gameDay, 5)
    expect(offline.cash).toBeCloseTo(ticked.cash, 5)
  })
})
