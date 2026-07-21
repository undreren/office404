import { MAX_EVENTS } from '../constants'
import { derangeText, unhingedPrefix, unhingedTier } from '../unhinged'
import type { GameEvent, MetaProgress } from '../types'
import type { GameMessage } from '../engine/Message'
import { uid, type SimCtx } from './simCtx'

export function eventMessage(ctx: SimCtx, meta: MetaProgress, message: string): string {
  const tier = unhingedTier(meta.totalHallucinationsEarned)
  const text = typeof message === 'string' ? message : ''
  return unhingedPrefix(tier) + derangeText(text, tier, ctx.rng.state)
}

export function buildGameEvent(
  ctx: SimCtx,
  meta: MetaProgress,
  type: GameEvent['type'],
  message: string,
  at: number,
): GameEvent {
  return {
    id: uid(ctx, 'evt'),
    timestamp: at,
    type,
    message: eventMessage(ctx, meta, message),
  }
}

export function prependEvents(events: GameEvent[], entry: GameEvent): GameEvent[] {
  return [entry, ...events].slice(0, MAX_EVENTS)
}

/** Fold tick-emitted events onto a log in emission order (same result as sequential prepends). */
export function foldTickEvents(events: GameEvent[], entries: readonly GameEvent[]): GameEvent[] {
  if (entries.length === 0) return events
  let next = events
  for (const entry of entries) {
    next = prependEvents(next, entry)
  }
  return next
}

/** Append one event to state (player actions and legacy tick paths). */
export function pushEvent(
  ctx: SimCtx,
  meta: MetaProgress,
  events: GameEvent[],
  type: GameEvent['type'],
  message: string,
  at: number,
): GameEvent[] {
  return prependEvents(events, buildGameEvent(ctx, meta, type, message, at))
}

/** Dispatchable message that prepends a simulation event to the log. */
export function prependGameEventMsg(at: number, entry: GameEvent): GameMessage {
  return {
    at,
    apply: (state) => ({
      ...state,
      events: prependEvents(state.events, entry),
    }),
  }
}
