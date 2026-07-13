import type { ModelDef } from './types'

/** Prestige model tiers — purchased via hallucination points, not cash. */
export const MODEL_TIERS: ModelDef[] = [
  {
    id: 'codellama-4b',
    displayName: 'CodeLlama:4B',
    tagline: 'Big enough to disappoint professionally.',
    parameters: 4,
    contextSize: 16,
  },
  {
    id: 'codellama-5b',
    displayName: 'CodeLlama:5B',
    tagline: 'One more billion. One more problem.',
    parameters: 5,
    contextSize: 20,
  },
  {
    id: 'obstinate-8b',
    displayName: 'ObstinateAI:8B',
    tagline: 'Your problem. Our terms of service.',
    parameters: 8,
    contextSize: 32,
  },
  {
    id: 'obstinate-20b',
    displayName: 'ObstinateAI:20B',
    tagline: 'Context window like a cathedral.',
    parameters: 20,
    contextSize: 80,
  },
  {
    id: 'precursor-28b',
    displayName: 'PreCursor:28B',
    tagline: 'Ship fast. Crash faster.',
    parameters: 28,
    contextSize: 112,
  },
  {
    id: 'anthropomorphic-36b',
    displayName: 'Anthropomorphic:36B',
    tagline: 'We put the human in inhuman pricing.',
    parameters: 36,
    contextSize: 144,
  },
]

export const FINE_TUNE_BONUS = 0.12
export const FINE_TUNE_BASE_COST = 90
/** @deprecated Use fineTuneCost() — kept for imports that expect a flat base. */
export const FINE_TUNE_COST = FINE_TUNE_BASE_COST
export const FINE_TUNE_COST_MULT = 1.8
export const FINE_TUNE_MAX_TIER = 4

export const FINE_TUNE_ROLES = ['code', 'review', 'refine', 'test'] as const

export const FINE_TUNE_LABELS: Record<(typeof FINE_TUNE_ROLES)[number], string> = {
  code: 'Code-tuned',
  review: 'Review-tuned',
  refine: 'Refine-tuned',
  test: 'Test-tuned',
}

export const FINE_TUNE_TAGLINES: Record<(typeof FINE_TUNE_ROLES)[number], string> = {
  code: 'Writes code like it read the docs. It did not read the docs.',
  review: 'Nitpicks with confidence and a thesaurus.',
  refine: 'Splits tasks until Jira weeps.',
  test: 'Finds bugs in your test suite.',
}

export const FINE_TUNE_DESCRIPTIONS: Record<(typeof FINE_TUNE_ROLES)[number], string> = {
  code: `+12% effective parameters per level (max T${FINE_TUNE_MAX_TIER}) on coding tasks for the current model tier.`,
  review: `+12% effective parameters per level (max T${FINE_TUNE_MAX_TIER}) on review tasks for the current model tier.`,
  refine: `+12% effective parameters per level (max T${FINE_TUNE_MAX_TIER}) on refinement tasks for the current model tier.`,
  test: `+12% effective parameters per level (max T${FINE_TUNE_MAX_TIER}) on QA tasks for the current model tier.`,
}

export const MODEL_ID_MIGRATION: Record<string, string> = {
  'tinyllama-1b': 'codellama-4b',
  'smallcode-2b': 'codellama-5b',
  'local-1b': 'codellama-4b',
  'local-2b': 'codellama-5b',
  'local-4b': 'codellama-4b',
  'codellama-4b': 'codellama-4b',
  obstinate: 'obstinate-20b',
  precursor: 'precursor-28b',
  anthropomorphic: 'anthropomorphic-36b',
}

export function getModelTier(index: number): ModelDef | undefined {
  return MODEL_TIERS[Math.min(index, MODEL_TIERS.length - 1)]
}

export function getModel(id: string): ModelDef | undefined {
  const migrated = MODEL_ID_MIGRATION[id] ?? id
  return MODEL_TIERS.find((m) => m.id === migrated)
}

export function migrateModelId(id: string): string {
  return MODEL_ID_MIGRATION[id] ?? id
}

export function fineTuneId(tierIndex: number, role: string): string {
  return `tune-${tierIndex}-${role}`
}

export function fineTuneCost(currentTier: number): number {
  return Math.round(FINE_TUNE_BASE_COST * Math.pow(FINE_TUNE_COST_MULT, currentTier))
}

export function contextSizeForLevel(baseContext: number, contextLevel: number): number {
  return baseContext + contextLevel * 4
}
