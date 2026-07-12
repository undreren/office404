import { acceptLeadMsg } from '../../messages'
import type { GameState } from '../../types'
import { dispatchChain } from './dispatchChain'
import { stateWithAvailableLead } from './stateWithAvailableLead'
import { SEED, T0 } from './testConstants'

export function stateWithAcceptedProject(seed: number = SEED): GameState {
  const state = stateWithAvailableLead(seed)
  const lead = state.leads.find((l) => l.status === 'available')
  if (!lead) throw new Error('expected available lead')
  return dispatchChain(state, [acceptLeadMsg(T0 + 2000, lead.id)])
}
