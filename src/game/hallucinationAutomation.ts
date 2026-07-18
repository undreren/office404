import type { MetaProgress } from './meta'
import { getHallucinationLevel } from './meta'
import {
  hasActiveAutomationAgent,
  hasConductorCourse,
  hasProjectManagerActive,
} from './mechanics'
import type { Agent, Project } from './types'

export function hasSuperConductor(meta: MetaProgress): boolean {
  return getHallucinationLevel(meta, 'super_conductor') >= 1
}

export function pmAbsorbsClientConductor(meta: MetaProgress, agents: Agent[]): boolean {
  return hasSuperConductor(meta) && hasProjectManagerActive(agents)
}

export function projectUsesConductorAutomation(
  vibingCourses: string[],
  meta: MetaProgress,
  agents: Agent[],
  project: Pick<Project, 'kind' | 'useConductor'>,
): boolean {
  if (!project.useConductor) return false
  if (hasConductorCourse(vibingCourses)) return true
  return project.kind === 'client' && pmAbsorbsClientConductor(meta, agents)
}

export function projectUsesVirtualConductor(
  meta: MetaProgress,
  agents: Agent[],
  project: Pick<Project, 'kind' | 'useConductor'>,
): boolean {
  return project.useConductor && project.kind === 'client' && pmAbsorbsClientConductor(meta, agents)
}

export function shouldAutoConductorClientProject(
  vibingCourses: string[],
  meta: MetaProgress,
  agents: Agent[],
): boolean {
  return (
    hasProjectManagerActive(agents) &&
    (hasConductorCourse(vibingCourses) || hasSuperConductor(meta))
  )
}

export function canToggleConductorOnProject(
  vibingCourses: string[],
  meta: MetaProgress,
  agents: Agent[],
  project: Pick<Project, 'kind'>,
): boolean {
  if (hasConductorCourse(vibingCourses)) return true
  return project.kind === 'client' && pmAbsorbsClientConductor(meta, agents)
}

export function accountingPaymentMultiplier(meta: MetaProgress, agents: Agent[]): number {
  const level = getHallucinationLevel(meta, 'accounting')
  if (level <= 0 || !hasActiveAutomationAgent(agents, 'accounting')) return 1
  return 1 + 0.05 * level
}

export function customerNegotiateMultiplier(meta: MetaProgress, agents: Agent[]): number {
  const level = getHallucinationLevel(meta, 'customer')
  if (level <= 0 || !hasActiveAutomationAgent(agents, 'customer')) return 1
  return 1 + 0.1 * level
}

export function marketingScopeMultiplier(meta: MetaProgress, agents: Agent[]): number {
  const level = getHallucinationLevel(meta, 'marketing')
  if (level <= 0 || !hasActiveAutomationAgent(agents, 'marketing')) return 1
  return 1 + 0.1 * level
}

export function syntheticLeadPayMultiplier(meta: MetaProgress): number {
  const customerLevel = getHallucinationLevel(meta, 'customer')
  const marketingLevel = getHallucinationLevel(meta, 'marketing')
  if (customerLevel <= 0 || marketingLevel <= 0) return 1
  return 1 + 0.15 * customerLevel
}

export function canMarketingSpawnSyntheticLeads(meta: MetaProgress, agents: Agent[]): boolean {
  return (
    getHallucinationLevel(meta, 'marketing') > 0 &&
    getHallucinationLevel(meta, 'customer') > 0 &&
    hasActiveAutomationAgent(agents, 'marketing')
  )
}

/** Days between synthetic lead spawns (lower with higher marketing + customer levels). */
export function syntheticLeadIntervalDays(meta: MetaProgress): number {
  const marketingLevel = getHallucinationLevel(meta, 'marketing')
  const customerLevel = getHallucinationLevel(meta, 'customer')
  return Math.max(2, 8 - marketingLevel - customerLevel)
}
