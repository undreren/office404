export {
  agentCapacity,
  canStaffAdditionalAgent,
  getNetWorth,
  getNextApartment,
  isReadyToDeliver,
  modelSpPerTick,
  projectProgressPct,
} from '../simulation/gameLogic'

export { agentContextDisplayPct, agentJobDurationDays, agentWorkProgressPct } from '../mechanics'

import type { Agent, GameState } from '../types'
import { SECONDS_PER_GAME_DAY } from '../constants'

/** Elapsed game-days since the last committed snapshot. */
export function elapsedGameDays(state: GameState, now: number): number {
  const elapsedSec = Math.max(0, (now - state.snapshotAt) / 1000)
  return elapsedSec / SECONDS_PER_GAME_DAY
}

/** Agent job progress derived from snapshot + wall clock (for refine/review roles). */
export function agentDerivedProgress(
  agent: Pick<Agent, 'job' | 'jobProgress' | 'jobDuration' | 'status'>,
  state: GameState,
  now: number,
): number | null {
  if (
    (agent.job !== 'refine' && agent.job !== 'review') ||
    agent.jobDuration <= 0 ||
    agent.status === 'idle'
  ) {
    return null
  }
  const elapsed = elapsedGameDays(state, now)
  return Math.min(100, ((agent.jobProgress + elapsed) / agent.jobDuration) * 100)
}
