import type { HallucinationLevels } from './types'

export interface MetaProgress {
  /** Unspent hallucination points. */
  hallucinationPoints: number
  /** Total ever earned — drives unhinged text intensity. */
  totalHallucinationsEarned: number
  /** Highest ladder rung index ever cleared (1-based). */
  highestRungEver: number
  retirementCount: number
  singularityCount: number
  hallucinationLevels: HallucinationLevels
}

export function createDefaultMeta(): MetaProgress {
  return {
    hallucinationPoints: 0,
    totalHallucinationsEarned: 0,
    highestRungEver: 0,
    retirementCount: 0,
    singularityCount: 0,
    hallucinationLevels: {},
  }
}

export function getHallucinationLevel(meta: MetaProgress, track: string): number {
  return meta.hallucinationLevels[track] ?? 0
}

export function setHallucinationLevel(
  meta: MetaProgress,
  track: string,
  level: number,
): MetaProgress {
  return {
    ...meta,
    hallucinationLevels: { ...meta.hallucinationLevels, [track]: level },
  }
}
