import type { GameEvent } from '../../types'
import type { GameMessage } from '../../engine/Message'
import type { MetaProgress } from '../../types'
import { buildGameEvent, prependGameEventMsg } from '../../simulation/events'
import type { SimCtx } from '../../simulation/simCtx'

/** Collects tick-time events as dispatchable messages instead of mutating state inline. */
export class TickEmitter {
  readonly messages: GameMessage[] = []

  emit(
    ctx: SimCtx,
    meta: MetaProgress,
    type: GameEvent['type'],
    message: string,
    at: number,
  ): void {
    const entry = buildGameEvent(ctx, meta, type, message, at)
    this.messages.push(prependGameEventMsg(at, entry))
  }
}
