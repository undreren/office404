import { dispatch } from '../../engine/dispatch'
import type { GameMessage } from '../../engine/Message'
import type { GameState } from '../../types'

export function dispatchChain(state: GameState, messages: GameMessage[]): GameState {
  return messages.reduce((s, msg) => dispatch(s, msg), state)
}
