import type { MetaProgress } from './meta'
import { getHallucinationLevel } from './meta'
import { PRODUCT_FEATURE_SP_INCREMENT } from './constants'
import { computeMrrGain, FIBONACCI } from './mechanics'
import { HOUSING_CONFIG } from './housing'
import type { ProductBacklogItem, Project } from './types'
import type { SimCtx } from './simulation/simCtx'
import { uid } from './simulation/simCtx'
import { defaultProjectFields } from './projects'

const PRODUCT_TITLES = [
  'Auth module that knows who you are (allegedly)',
  'Billing integration that invoices feelings',
  'Agent orchestrator for orchestrating orchestrators',
  'Analytics dashboard the CEO will misread',
  'Internal API nobody documented on purpose',
  'Feature flag system for flags about flags',
  'Webhook receiver with commitment issues',
]

export function createProductBacklogItem(ctx: SimCtx, sp: number): ProductBacklogItem {
  return {
    id: uid(ctx, 'prod'),
    title: ctx.rng.pick(PRODUCT_TITLES),
    storyPoints: sp,
    status: 'queued',
  }
}

export function activateProductFeature(
  ctx: SimCtx,
  item: ProductBacklogItem,
): Project {
  const projectId = uid(ctx, 'proj')
  const sp = item.storyPoints
  return {
    id: projectId,
    clientName: 'In-House Product',
    clientTagline: 'MRR or bust.',
    blurb: item.title,
    payment: 0,
    durationDays: 0,
    daysRemaining: 9999,
    isTutorial: false,
    repPenaltyMultiplier: 1,
    ...defaultProjectFields(ctx, projectId, sp, 'product'),
  }
}

export function mrrOnShip(
  featureSp: number,
  featuresShipped: number,
  apartment: keyof typeof HOUSING_CONFIG,
): number {
  return computeMrrGain(featureSp, featuresShipped, HOUSING_CONFIG[apartment].mrrMultiplier)
}

export function canAccessProduct(meta: MetaProgress): boolean {
  return getHallucinationLevel(meta, 'in_house') >= 1
}

export function nextProductFeatureSp(featuresShipped: number): number {
  if (featuresShipped < FIBONACCI.length) return FIBONACCI[featuresShipped]
  const last = FIBONACCI[FIBONACCI.length - 1]
  const beyond = featuresShipped - FIBONACCI.length + 1
  return last + beyond * PRODUCT_FEATURE_SP_INCREMENT
}

export function countActiveProductProjects(projects: Project[]): number {
  return projects.filter((p) => p.kind === 'product' && p.status === 'active').length
}

export function ensureProductBacklogQueued(
  ctx: SimCtx,
  backlog: ProductBacklogItem[],
  featuresShipped: number,
): ProductBacklogItem[] {
  if (backlog.some((item) => item.status === 'queued')) return backlog
  return [...backlog, createProductBacklogItem(ctx, nextProductFeatureSp(featuresShipped))]
}
