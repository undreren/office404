import { acceptLeadMsg } from '../../messages'
import { generateLead } from '../../projects'
import { ctxFrom } from '../../simulation/simCtx'
import type { GameState } from '../../types'
import { dispatchChain } from './dispatchChain'
import { initialPlaying } from './initialPlaying'
import { SEED, T0 } from './testConstants'

export function stateWithAcceptedProject(seed: number = SEED): GameState {
  const base = { ...initialPlaying(seed), tutorialDone: true, projects: [] }
  const ctx = ctxFrom(base)
  const lead = generateLead(ctx, base.reputation, base.gameDay)
  const withLead = {
    ...base,
    leads: [{ ...lead, daysToExpire: 30 }],
    leadSpawnCooldown: 999,
  }
  return dispatchChain(withLead, [acceptLeadMsg(T0 + 2000, lead.id)])
}
