import type { GameMessage } from '../engine/Message'
import type { AdvanceTimeFn, AdvanceTimeResult } from './types'

/**
 * Synchronize child advance results to the earliest stopping timestamp.
 * Over-advanced children are re-asked from their original value.
 */
export function syncChildAdvances<T>(
  originals: readonly T[],
  firstPass: readonly AdvanceTimeResult<T>[],
  advance: AdvanceTimeFn<T>,
): AdvanceTimeResult<T[]> {
  if (originals.length === 0) {
    return { value: [], messages: [], timestamp: Number.POSITIVE_INFINITY }
  }

  const timestamp = Math.min(...firstPass.map((r) => r.timestamp))
  const messages: GameMessage[] = []
  const value: T[] = []

  for (let i = 0; i < originals.length; i++) {
    const orig = originals[i]!
    const result = firstPass[i]!
    const synced = result.timestamp <= timestamp ? result : advance(orig, timestamp)
    value.push(synced.value)
    messages.push(...synced.messages)
  }

  return { value, messages, timestamp }
}

export function mergeAdvanceResults(
  results: AdvanceTimeResult<unknown>[],
): { timestamp: number; messages: GameMessage[] } {
  if (results.length === 0) {
    return { timestamp: Number.POSITIVE_INFINITY, messages: [] }
  }
  return {
    timestamp: Math.min(...results.map((r) => r.timestamp)),
    messages: results.flatMap((r) => r.messages),
  }
}
