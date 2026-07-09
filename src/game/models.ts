import type { ModelDef } from './types'

export const CLOUD_VENDORS = {
  anthropomorphic: {
    id: 'anthropomorphic',
    name: 'Anthropomorphic',
    tagline: 'We put the "human" in "inhuman pricing."',
  },
  obstinate: {
    id: 'obstinate',
    name: 'ObstinateAI',
    tagline: 'Your problem. Our terms of service.',
  },
  precursor: {
    id: 'precursor',
    name: 'PreCursor',
    tagline: 'Ship fast. Crash faster. Tab-complete your regrets.',
  },
} as const

export const MODELS: Record<string, ModelDef> = {
  'local-1b': {
    id: 'local-1b',
    name: 'TinyLlama 1B',
    kind: 'local',
    tagline: 'Fits on a laptop. Barely fits in production.',
    parameters: 1,
    contextSize: 4,
    loadRam: 2,
    tokenCostPerTick: 0,
    purchaseCost: 0,
    deployCost: 0,
  },
  'local-2b': {
    id: 'local-2b',
    name: 'SmallCode 2B',
    kind: 'local',
    tagline: 'Twice the params. Still unemployable.',
    parameters: 2,
    contextSize: 8,
    loadRam: 4,
    tokenCostPerTick: 0,
    purchaseCost: 0,
    deployCost: 0,
  },
  'local-4b': {
    id: 'local-4b',
    name: 'CodeLlama 4B',
    kind: 'local',
    tagline: 'Big enough to disappoint professionally.',
    parameters: 4,
    contextSize: 16,
    loadRam: 6,
    tokenCostPerTick: 0,
    purchaseCost: 0,
    deployCost: 0,
  },
  obstinate: {
    id: 'obstinate',
    name: 'ObstinateAI',
    vendor: 'obstinate',
    kind: 'cloud',
    tagline: 'Your problem. Our terms of service.',
    parameters: 20,
    contextSize: 80,
    loadRam: 0,
    tokenCostPerTick: 1.2,
    purchaseCost: 0,
    deployCost: 45,
  },
  precursor: {
    id: 'precursor',
    name: 'PreCursor',
    vendor: 'precursor',
    kind: 'cloud',
    tagline: 'Ship fast. Crash faster. Tab-complete your regrets.',
    parameters: 28,
    contextSize: 112,
    loadRam: 0,
    tokenCostPerTick: 1.8,
    purchaseCost: 0,
    deployCost: 75,
  },
  anthropomorphic: {
    id: 'anthropomorphic',
    name: 'Anthropomorphic',
    vendor: 'anthropomorphic',
    kind: 'cloud',
    tagline: 'We put the "human" in "inhuman pricing."',
    parameters: 36,
    contextSize: 144,
    loadRam: 0,
    tokenCostPerTick: 2.6,
    purchaseCost: 0,
    deployCost: 120,
  },
}

/** Migrate saves from older model IDs */
export const MODEL_ID_MIGRATION: Record<string, string> = {
  'fab-lite': 'obstinate',
  'fab-pro': 'precursor',
  'fab-ultra': 'anthropomorphic',
  'local-7b': 'local-1b',
  'local-13b': 'local-2b',
  'local-34b': 'local-4b',
}

export const LOCAL_MODEL_LIST = Object.values(MODELS).filter((m) => m.kind === 'local')
export const CLOUD_MODEL_LIST = Object.values(MODELS).filter((m) => m.kind === 'cloud')

export function getModel(id: string): ModelDef | undefined {
  const migrated = MODEL_ID_MIGRATION[id] ?? id
  return MODELS[migrated]
}

export function migrateModelId(id: string): string {
  return MODEL_ID_MIGRATION[id] ?? id
}
