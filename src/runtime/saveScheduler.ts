import type { GameState } from '../game/types'
import { savePersistedState } from './persist'

const SAVE_DEBOUNCE_MS = 500

let pendingTimer: ReturnType<typeof setTimeout> | null = null
let latestState: GameState | null = null

export function trackPersistSave(state: GameState): void {
  latestState = state
  if (pendingTimer) clearTimeout(pendingTimer)
  pendingTimer = setTimeout(() => {
    pendingTimer = null
    if (latestState) savePersistedState(latestState)
  }, SAVE_DEBOUNCE_MS)
}

/** Persist immediately — used on tab hide / page close so recent actions are not lost. */
export function flushPersistSave(state?: GameState, at = Date.now()): void {
  if (pendingTimer) {
    clearTimeout(pendingTimer)
    pendingTimer = null
  }
  const toSave = state ?? latestState
  if (!toSave) return
  latestState = toSave
  savePersistedState({ ...toSave, snapshotAt: at })
}

export function resetPersistSaveScheduler(): void {
  if (pendingTimer) clearTimeout(pendingTimer)
  pendingTimer = null
  latestState = null
}

export { SAVE_DEBOUNCE_MS }
