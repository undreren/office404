import { MAX_EVENTS, MAX_OFFLINE_SECONDS, MIN_OFFLINE_APPLY_SEC } from '../constants'
import { hasOfflineCourse } from '../mechanics'
import type { GameState } from '../types'
import { ctxFrom, uid, withCtx } from '../simulation/simCtx'
import { catchUpTo } from './catchUp'

function finalizeOfflineAwayEvent(state: GameState, before: GameState, at: number): GameState {
  const awaySec = Math.max(0, (at - before.snapshotAt) / 1000)
  const cappedSec = Math.min(awaySec, MAX_OFFLINE_SECONDS)
  const awayMinutes = Math.floor(cappedSec / 60)
  const awayLabel =
    awayMinutes >= 60
      ? `${Math.floor(awayMinutes / 60)}h ${awayMinutes % 60}m`
      : `${awayMinutes}m`

  const ctx = ctxFrom(state)
  const entry = {
    id: uid(ctx, 'evt'),
    timestamp: at,
    type: 'system' as const,
    message: `Away for ${awayLabel}. Offline Agent hallucinated the elapsed time.`,
  }
  return withCtx(
    {
      ...state,
      events: [entry, ...state.events].slice(0, MAX_EVENTS),
    },
    ctx,
    at,
  )
}

/** Catch up wall-clock absence when the offline course is owned. */
export function catchUpOffline(state: GameState, at: number): GameState {
  if (!hasOfflineCourse(state.vibingCourses) || state.phase !== 'playing') {
    return { ...state, snapshotAt: at }
  }

  const elapsedSec = Math.max(0, (at - state.snapshotAt) / 1000)
  if (elapsedSec < MIN_OFFLINE_APPLY_SEC) {
    return { ...state, snapshotAt: at }
  }

  const wallEnd = state.snapshotAt + Math.min(elapsedSec, MAX_OFFLINE_SECONDS) * 1000
  const before = state
  const caught = catchUpTo(state, wallEnd)
  return finalizeOfflineAwayEvent({ ...caught, snapshotAt: at }, before, at)
}
