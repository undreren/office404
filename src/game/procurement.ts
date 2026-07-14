import { formatCash } from './cash'
import { HOUSING_CONFIG, nextHousingTier } from './housing'
import { getHallucinationLevel } from './meta'
import {
  FINE_TUNE_LABELS,
  FINE_TUNE_MAX_TIER,
  FINE_TUNE_ROLES,
  fineTuneCost,
  fineTuneId,
} from './models'
import {
  getFineTuneLevel,
  gpuTickCost,
  maxAgentSlotPurchases,
  maxGpuTickPurchases,
  ramSlotCost,
} from './mechanics'
import type { ApartmentTier, GameState } from './types'
import { cheapestAffordableVibingCourse } from './upgrades'

export type ProcurementPurchase =
  | { kind: 'ram'; cost: number }
  | { kind: 'gpu'; cost: number }
  | { kind: 'housing'; cost: number; next: ApartmentTier }
  | { kind: 'fine_tune'; cost: number; id: string; newTier: number; role: (typeof FINE_TUNE_ROLES)[number] }
  | {
      kind: 'vibing_course'
      cost: number
      courseId: string
      label: string
      newTier: number
      maxTier: number
    }

export type ProcurementState = Pick<
  GameState,
  | 'apartment'
  | 'agentSlotPurchases'
  | 'gpuTickPurchases'
  | 'vibingCourses'
  | 'vibingCourseTiers'
  | 'purchasedFineTunes'
  | 'fineTuneTiers'
  | 'meta'
>

export function findCheapestProcurementPurchase(
  state: ProcurementState,
  budget: number,
  cash: number,
): ProcurementPurchase | null {
  let best: ProcurementPurchase | null = null
  let bestCost = Infinity

  const consider = (purchase: ProcurementPurchase, cost: number) => {
    if (cost <= budget && cash >= cost && cost < bestCost) {
      best = purchase
      bestCost = cost
    }
  }

  const maxSlots = maxAgentSlotPurchases(state.apartment)
  if (state.agentSlotPurchases < maxSlots) {
    const cost = ramSlotCost(state.agentSlotPurchases)
    consider({ kind: 'ram', cost }, cost)
  }

  const maxTicks = maxGpuTickPurchases(state.apartment)
  if (state.gpuTickPurchases < maxTicks) {
    const cost = gpuTickCost(state.gpuTickPurchases)
    consider({ kind: 'gpu', cost }, cost)
  }

  const nextApt = nextHousingTier(state.apartment)
  if (nextApt) {
    const cost = HOUSING_CONFIG[nextApt].upgradeCost
    consider({ kind: 'housing', cost, next: nextApt }, cost)
  }

  const modelLevel = getHallucinationLevel(state.meta, 'model')
  for (const role of FINE_TUNE_ROLES) {
    const id = fineTuneId(modelLevel, role)
    const currentTier = getFineTuneLevel(state.fineTuneTiers, state.purchasedFineTunes, id)
    if (currentTier >= FINE_TUNE_MAX_TIER) continue
    const cost = fineTuneCost(currentTier)
    consider({ kind: 'fine_tune', cost, id, newTier: currentTier + 1, role }, cost)
  }

  const coursePurchase = cheapestAffordableVibingCourse(
    state.vibingCourses,
    state.vibingCourseTiers,
    budget,
    cash,
  )
  if (coursePurchase) {
    const { course, cost, newTier } = coursePurchase
    consider(
      {
        kind: 'vibing_course',
        cost,
        courseId: course.id,
        label: course.label,
        newTier,
        maxTier: course.maxTier ?? 1,
      },
      cost,
    )
  }

  return best
}

export function procurementEventMessage(purchase: ProcurementPurchase): string {
  switch (purchase.kind) {
    case 'ram':
      return `Procurement auto-bought +1 RAM for ${formatCash(purchase.cost)}.`
    case 'gpu':
      return `Procurement auto-bought +1 GPU for ${formatCash(purchase.cost)}.`
    case 'housing':
      return `Procurement auto-moved to ${HOUSING_CONFIG[purchase.next].label} for ${formatCash(purchase.cost)}.`
    case 'fine_tune':
      return `Procurement auto-bought ${FINE_TUNE_LABELS[purchase.role]} T${purchase.newTier} for ${formatCash(purchase.cost)}.`
    case 'vibing_course': {
      const tierNote = purchase.maxTier > 1 ? ` T${purchase.newTier}/${purchase.maxTier}` : ''
      return `Procurement auto-enrolled in ${purchase.label}${tierNote} for ${formatCash(purchase.cost)}.`
    }
  }
}
