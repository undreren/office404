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
  'local-7b': {
    id: 'local-7b',
    name: 'Llama Lite 7B',
    kind: 'local',
    tagline: 'Free. Depressing. Like instant coffee.',
    parameters: 7,
    contextSize: 8,
    ramCost: 4,
    successChance: 0.42,
    contextFillRate: 0.35,
    tokenCostPerTick: 0,
    purchaseCost: 0,
    localTickCap: 0.45,
    deployCost: 0,
  },
  'local-13b': {
    id: 'local-13b',
    name: 'Mistral Meh 13B',
    kind: 'local',
    tagline: 'Shelf ware with ambition issues.',
    parameters: 13,
    contextSize: 16,
    ramCost: 8,
    successChance: 0.55,
    contextFillRate: 0.28,
    tokenCostPerTick: 0,
    purchaseCost: 0,
    localTickCap: 0.55,
    deployCost: 0,
  },
  'local-34b': {
    id: 'local-34b',
    name: 'CodeLlama 34B',
    kind: 'local',
    tagline: 'Big params. Small apartment dreams.',
    parameters: 34,
    contextSize: 32,
    ramCost: 16,
    successChance: 0.68,
    contextFillRate: 0.22,
    tokenCostPerTick: 0,
    purchaseCost: 0,
    localTickCap: 0.65,
    deployCost: 0,
  },
  anthropomorphic: {
    id: 'anthropomorphic',
    name: 'Anthropomorphic',
    vendor: 'anthropomorphic',
    kind: 'cloud',
    tagline: 'We put the "human" in "inhuman pricing."',
    parameters: 70,
    contextSize: 128,
    ramCost: 0,
    successChance: 0.88,
    contextFillRate: 0.12,
    tokenCostPerTick: 2.4,
    purchaseCost: 0,
    localTickCap: 1,
    deployCost: 120,
  },
  obstinate: {
    id: 'obstinate',
    name: 'ObstinateAI',
    vendor: 'obstinate',
    kind: 'cloud',
    tagline: 'Your problem. Our terms of service.',
    parameters: 13,
    contextSize: 32,
    ramCost: 0,
    successChance: 0.55,
    contextFillRate: 0.32,
    tokenCostPerTick: 0.9,
    purchaseCost: 0,
    localTickCap: 1,
    deployCost: 45,
  },
  precursor: {
    id: 'precursor',
    name: 'PreCursor',
    vendor: 'precursor',
    kind: 'cloud',
    tagline: 'Ship fast. Crash faster. Tab-complete your regrets.',
    parameters: 40,
    contextSize: 64,
    ramCost: 0,
    successChance: 0.78,
    contextFillRate: 0.22,
    tokenCostPerTick: 1.5,
    purchaseCost: 0,
    localTickCap: 1,
    deployCost: 75,
  },
}

/** Migrate saves from the old Fabulous5 model IDs */
export const MODEL_ID_MIGRATION: Record<string, string> = {
  'fab-lite': 'obstinate',
  'fab-pro': 'precursor',
  'fab-ultra': 'anthropomorphic',
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
