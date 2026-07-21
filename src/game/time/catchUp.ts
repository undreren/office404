import { dispatch } from '../engine/dispatch'
import type { GameMessage } from '../engine/Message'
import type { GameState } from '../types'
import { advanceSimulationDelta } from './simulation'
import type { AdvanceTimeResult } from './types'
import { findNextBoundaryMs } from './nextBoundary'
import { isCaughtUp } from './timeMath'

export type CatchUpOptions = {
  /** Skip tick event emission (offline catch-up fast path). */
  silent?: boolean
}

function applyStepMessages(state: GameState, messages: GameMessage[]): GameState {
  return messages.reduce((s, message) => dispatch(s, message), state)
}

function simulationOptions(options?: CatchUpOptions) {
  if (!options?.silent) return undefined
  return { eventsOnly: true, silent: true } as const
}

/** Advance one synchronized simulation step toward targetTime (unix ms). */
export function advanceGameStateStep(
  state: GameState,
  targetTime: number,
  options?: CatchUpOptions,
): AdvanceTimeResult<GameState> {
  if (state.phase !== 'playing' || targetTime <= state.snapshotAt) {
    return { value: state, messages: [], timestamp: state.snapshotAt }
  }

  const boundary = findNextBoundaryMs(state, targetTime)
  const wallMs = Math.max(0, boundary - state.snapshotAt)
  const deltaSec = wallMs / 1000

  const { state: stepped, messages } = advanceSimulationDelta(
    state,
    deltaSec,
    boundary,
    simulationOptions(options),
  )
  return { value: stepped, messages, timestamp: boundary }
}

/** Catch up from state.snapshotAt to now using greedy event-boundary steps. */
export function catchUpTo(state: GameState, now: number, options?: CatchUpOptions): GameState {
  if (state.phase !== 'playing') {
    return { ...state, snapshotAt: now }
  }

  let current = state
  while (!isCaughtUp(current, now)) {
    const step = advanceGameStateStep(current, now, options)
    if (options?.silent) {
      current = step.value
    } else {
      current = applyStepMessages(step.value, step.messages)
      current = { ...current, snapshotAt: step.timestamp }
    }
  }

  return { ...current, snapshotAt: now }
}

/** Advance by a fixed number of real seconds (tests / legacy timeElapsed). */
export function advanceByRealSeconds(state: GameState, seconds: number, at: number): GameState {
  if (state.phase !== 'playing' || seconds <= 0) {
    return { ...state, snapshotAt: at }
  }

  const { state: stepped, messages } = advanceSimulationDelta(state, seconds, at)
  const merged = applyStepMessages(stepped, messages)
  return { ...merged, snapshotAt: at }
}

export function applyAdvanceStep(_state: GameState, step: AdvanceTimeResult<GameState>): GameState {
  const merged = applyStepMessages(step.value, step.messages)
  return { ...merged, snapshotAt: step.timestamp }
}
