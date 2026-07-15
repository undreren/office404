import { generateLead } from '../../projects'
import { ctxFrom } from '../../simulation/simCtx'
import type { GameState } from '../../types'
import { initialPlaying } from './initialPlaying'
import { SEED } from './testConstants'

/** Post-tutorial state with one available lead (injected for stable tests). */
export function stateWithAvailableLead(seed: number = SEED): GameState {
  const state = {
    ...initialPlaying(seed),
    tutorialDone: true,
    projects: [],
    agents: [],
  }
  const ctx = ctxFrom(state)
  const lead = generateLead(ctx, state.reputation, state.gameDay, 0)
  return {
    ...state,
    leads: [lead],
  }
}
