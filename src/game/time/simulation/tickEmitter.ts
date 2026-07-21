import type { GameEvent } from '../../types'
import type { GameMessage } from '../../engine/Message'
import type { MetaProgress } from '../../types'
import { buildGameEvent, prependGameEventMsg } from '../../simulation/events'
import type { SimCtx } from '../../simulation/simCtx'

export type TickEmitterOptions = {
  /** When false, skip building dispatchable messages (faster offline catch-up). */
  buildMessages?: boolean
  /** When true, skip event collection entirely (offline catch-up fast path). */
  silent?: boolean
}

/** Collects tick-time events as dispatchable messages instead of mutating state inline. */
export class TickEmitter {
  readonly events: GameEvent[] = []
  readonly messages: GameMessage[] = []
  private readonly buildMessages: boolean
  private readonly silent: boolean

  constructor(options: TickEmitterOptions = {}) {
    this.silent = options.silent ?? false
    this.buildMessages = !this.silent && (options.buildMessages ?? true)
  }

  emit(
    ctx: SimCtx,
    meta: MetaProgress,
    type: GameEvent['type'],
    message: string,
    at: number,
  ): void {
    if (this.silent) return
    const entry = buildGameEvent(ctx, meta, type, message, at)
    this.events.push(entry)
    if (this.buildMessages) {
      this.messages.push(prependGameEventMsg(at, entry))
    }
  }
}
