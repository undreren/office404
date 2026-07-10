import type { ApartmentTier } from './types'

export interface RamUpgrade {
  id: string
  tier: number
  label: string
  tagline: string
  ramGb: number
  cost: number
  housingRequired: ApartmentTier
}

export interface GpuUpgrade {
  id: string
  tier: number
  label: string
  tagline: string
  gpus: number
  cost: number
  housingRequired: ApartmentTier
}

export interface VibingCourse {
  id: string
  label: string
  tagline: string
  cost: number
  description: string
}

export const RAM_UPGRADES: RamUpgrade[] = [
  {
    id: 'neighbors-ddr4',
    tier: 2,
    label: "Neighbor's DDR4",
    tagline: "He'll want it back.",
    ramGb: 6,
    cost: 80,
    housingRequired: 'shared_1br',
  },
  {
    id: 'mark-mini-ram',
    tier: 3,
    label: 'Mark Mini RAM Stick',
    tagline: 'Certified not a toaster. Probably.',
    ramGb: 8,
    cost: 180,
    housingRequired: 'studio',
  },
  {
    id: 'stfu-bulk-ram',
    tier: 4,
    label: 'STFU.io Bulk Pack',
    tagline: 'Ships in a bag labeled "DO NOT OPEN".',
    ramGb: 16,
    cost: 520,
    housingRequired: 'loft',
  },
  {
    id: 'cuda-palace-ram',
    tier: 5,
    label: 'CUDA Palace Memory',
    tagline: "Your landlord thinks it's a space heater.",
    ramGb: 32,
    cost: 1400,
    housingRequired: 'penthouse',
  },
]

export const GPU_UPGRADES: GpuUpgrade[] = [
  {
    id: 'marketplace-gpu',
    tier: 2,
    label: 'Facebook Marketplace GPU',
    tagline: 'Smells like cat. Performs like regret.',
    gpus: 2,
    cost: 100,
    housingRequired: 'shared_1br',
  },
  {
    id: 'mark-mini-gpu',
    tier: 3,
    label: 'Mark Mini GPU',
    tagline: 'Two cores. One prayer.',
    gpus: 2,
    cost: 200,
    housingRequired: 'studio',
  },
  {
    id: 'stfu-gpu-cluster',
    tier: 4,
    label: 'Mark STFU.io Cluster Card',
    tagline: 'Fans spin up like a jet engine.',
    gpus: 4,
    cost: 600,
    housingRequired: 'loft',
  },
  {
    id: 'cuda-cluster-gpu',
    tier: 5,
    label: 'CUDA Cluster',
    tagline: 'The power bill is a lifestyle choice.',
    gpus: 8,
    cost: 1500,
    housingRequired: 'penthouse',
  },
]

export const VIBING_COURSES: VibingCourse[] = [
  {
    id: 'prompt_engineering',
    label: 'Prompt Engineering',
    tagline: 'Make no mistakes.',
    cost: 150,
    description: 'Unlock slow 1→2 requirement splits during refine.',
  },
  {
    id: 'context_optimization',
    label: 'Context Optimization',
    tagline: "It's not forgetting — it's prioritizing.",
    cost: 200,
    description: 'Agents fill context 35% slower before compacting.',
  },
  {
    id: 'conductor',
    label: 'Conductor',
    tagline: 'Someone has to watch them. Might as well be someone fake.',
    cost: 350,
    description: 'Assign a Conductor per project to auto-staff roles within crew cap.',
  },
]

const HOUSING_ORDER: ApartmentTier[] = [
  'cardboard',
  'shared_1br',
  'studio',
  'loft',
  'penthouse',
]

export function housingMeetsRequirement(
  current: ApartmentTier,
  required: ApartmentTier,
): boolean {
  return HOUSING_ORDER.indexOf(current) >= HOUSING_ORDER.indexOf(required)
}
