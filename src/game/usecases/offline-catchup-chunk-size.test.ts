import { describe, expect, it } from 'vitest'
import {
  MAX_OFFLINE_SECONDS,
  OFFLINE_CATCHUP_CHUNK_SEC,
  SECONDS_PER_GAME_DAY,
  TICK_INTERVAL_MS,
} from '../constants'
import { applyOfflineProgressMsg, buyVibingCourseMsg } from '../messages'
import { advanceTime } from '../simulation/gameLogic'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'

function tickLoop(state: ReturnType<typeof enrolledBase>, elapsedSec: number) {
  const tickSec = TICK_INTERVAL_MS / 1000
  let advanced = state
  let remaining = elapsedSec
  while (remaining > 0) {
    const chunk = Math.min(remaining, tickSec)
    advanced = advanceTime(advanced, chunk, T0)
    remaining -= chunk
  }
  return advanced
}

function enrolledBase() {
  return dispatchChain(stateWithCash(initialPlaying(), 2000), [buyVibingCourseMsg(T0 + 500, 'offline')])
}

describe('offline-catchup-chunk-size', () => {
  it('uses coarser chunks than the live tick interval', () => {
    expect(OFFLINE_CATCHUP_CHUNK_SEC).toBeGreaterThan(TICK_INTERVAL_MS / 1000)
    expect(SECONDS_PER_GAME_DAY % OFFLINE_CATCHUP_CHUNK_SEC).toBe(0)
  })

  it('matches tick-by-tick simulation at max offline window', () => {
    const away = MAX_OFFLINE_SECONDS
    const before = enrolledBase()

    const ticked = tickLoop(before, away)
    const offline = dispatchChain(before, [applyOfflineProgressMsg(T0 + away * 1000, away)])

    expect(offline.gameDay).toBeCloseTo(ticked.gameDay, 5)
    expect(offline.cash).toBeCloseTo(ticked.cash, 5)
  })
})
