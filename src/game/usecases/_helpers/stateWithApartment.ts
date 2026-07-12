import { RENT_INTERVAL_DAYS } from '../../constants'
import type { ApartmentTier, GameState } from '../../types'

export function stateWithApartment(state: GameState, tier: ApartmentTier): GameState {
  return {
    ...state,
    apartment: tier,
    rentDueInDays: RENT_INTERVAL_DAYS,
    apartmentLeaseRemaining: RENT_INTERVAL_DAYS,
  }
}
