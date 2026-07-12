import { IdAllocator } from '../engine/ids'
import { Rng } from '../rng'
import type { GameState } from '../types'

export type SimCtx = { ids: IdAllocator; rng: Rng }

export function ctxFrom(state: GameState): SimCtx {
  return { ids: new IdAllocator(state.nextId), rng: new Rng(state.rng) }
}

export function withCtx(state: GameState, ctx: SimCtx, at: number): GameState {
  return { ...state, nextId: ctx.ids.nextId, rng: ctx.rng.state, snapshotAt: at }
}

export function uid(ctx: SimCtx, prefix: string): string {
  return ctx.ids.allocate(prefix)
}
