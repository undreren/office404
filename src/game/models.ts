import type { FineTuneRole, ModelDef } from './types'

export const MODEL_TIERS: ModelDef[] = [
  {
    id: 'tinyllama-1b',
    displayName: 'TinyLlama:1B',
    tagline: 'Fits on a laptop. Barely fits in production.',
    parameters: 1,
    contextSize: 4,
    ramPerAgent: 2,
    upgradeCost: 0,
  },
  {
    id: 'smallcode-2b',
    displayName: 'SmallCode:2B',
    tagline: 'Twice the params. Still unemployable.',
    parameters: 2,
    contextSize: 8,
    ramPerAgent: 3,
    upgradeCost: 120,
  },
  {
    id: 'codellama-4b',
    displayName: 'CodeLlama:4B',
    tagline: 'Big enough to disappoint professionally.',
    parameters: 4,
    contextSize: 16,
    ramPerAgent: 4,
    upgradeCost: 280,
  },
  {
    id: 'obstinate-20b',
    displayName: 'ObstinateAI:20B',
    tagline: 'Your problem. Our terms of service.',
    parameters: 20,
    contextSize: 80,
    ramPerAgent: 8,
    upgradeCost: 650,
  },
  {
    id: 'precursor-28b',
    displayName: 'PreCursor:28B',
    tagline: 'Ship fast. Crash faster. Tab-complete your regrets.',
    parameters: 28,
    contextSize: 112,
    ramPerAgent: 10,
    upgradeCost: 1200,
  },
  {
    id: 'anthropomorphic-36b',
    displayName: 'Anthropomorphic:36B',
    tagline: 'We put the "human" in "inhuman pricing."',
    parameters: 36,
    contextSize: 144,
    ramPerAgent: 12,
    upgradeCost: 2400,
  },
]

export const FINE_TUNE_BONUS = 0.12
export const FINE_TUNE_COST = 90

export const FINE_TUNE_ROLES: FineTuneRole[] = ['code', 'review', 'refine', 'test']

export const FINE_TUNE_LABELS: Record<FineTuneRole, string> = {
  code: 'Code-tuned',
  review: 'Review-tuned',
  refine: 'Refine-tuned',
  test: 'Test-tuned',
}

/** Migrate saves from older model IDs */
export const MODEL_ID_MIGRATION: Record<string, string> = {
  'local-1b': 'tinyllama-1b',
  'local-2b': 'smallcode-2b',
  'local-4b': 'codellama-4b',
  obstinate: 'obstinate-20b',
  precursor: 'precursor-28b',
  anthropomorphic: 'anthropomorphic-36b',
  'fab-lite': 'obstinate-20b',
  'fab-pro': 'precursor-28b',
  'fab-ultra': 'anthropomorphic-36b',
  'local-7b': 'tinyllama-1b',
  'local-13b': 'smallcode-2b',
  'local-34b': 'codellama-4b',
}

export function getModelTier(index: number): ModelDef | undefined {
  return MODEL_TIERS[index]
}

export function getModel(id: string): ModelDef | undefined {
  const migrated = MODEL_ID_MIGRATION[id] ?? id
  return MODEL_TIERS.find((m) => m.id === migrated)
}

export function migrateModelId(id: string): string {
  return MODEL_ID_MIGRATION[id] ?? id
}

export function fineTuneId(tierIndex: number, role: FineTuneRole): string {
  return `tune-${tierIndex}-${role}`
}
