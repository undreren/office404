import type { GameMessage } from './Message'
import type { GameState } from '../types'

export function dispatch(state: GameState, message: GameMessage): GameState {
  const next = message.apply(state)
  return { ...next, snapshotAt: message.at }
}

export function dispatchAll(state: GameState, messages: GameMessage[]): GameState {
  return messages.reduce((s, msg) => dispatch(s, msg), state)
}
