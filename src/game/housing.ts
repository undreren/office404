import type { ApartmentTier } from './types'

export interface HousingTierConfig {
  id: ApartmentTier
  label: string
  tagline: string
  rent: number
  upgradeCost: number
  hardwareBand: number
  maxRamPurchases: number
  maxGpuPurchases: number
  mrrMultiplier: number
}

export const HOUSING_ORDER: ApartmentTier[] = [
  'cardboard',
  'shared_1br',
  'studio',
  'loft',
  'penthouse',
  'campus',
  'regional_dc',
  'hyperscale_campus',
  'continental_grid',
  'planetary_backbone',
  'orbital_ring',
  'dyson_swarm',
  'dyson_sphere',
]

export const HOUSING_CONFIG: Record<ApartmentTier, HousingTierConfig> = {
  cardboard: {
    id: 'cardboard',
    label: 'Cardboard Box',
    tagline: 'Rent is low. Dignity is lower.',
    rent: 40,
    upgradeCost: 0,
    hardwareBand: 1,
    maxRamPurchases: 2,
    maxGpuPurchases: 2,
    mrrMultiplier: 1,
  },
  shared_1br: {
    id: 'shared_1br',
    label: 'Shared 1BR',
    tagline: 'Your roommate mines Ethereum. Loudly.',
    rent: 80,
    upgradeCost: 100,
    hardwareBand: 2,
    maxRamPurchases: 4,
    maxGpuPurchases: 4,
    mrrMultiplier: 1,
  },
  studio: {
    id: 'studio',
    label: 'Studio Apartment',
    tagline: 'One room. Zero boundaries.',
    rent: 120,
    upgradeCost: 200,
    hardwareBand: 3,
    maxRamPurchases: 6,
    maxGpuPurchases: 6,
    mrrMultiplier: 1,
  },
  loft: {
    id: 'loft',
    label: 'Loft (STFU.io eligible)',
    tagline: 'Exposed brick. Exposed API keys.',
    rent: 280,
    upgradeCost: 600,
    hardwareBand: 4,
    maxRamPurchases: 8,
    maxGpuPurchases: 8,
    mrrMultiplier: 1,
  },
  penthouse: {
    id: 'penthouse',
    label: 'Penthouse CUDA Palace',
    tagline: 'The view costs extra. So does inference.',
    rent: 650,
    upgradeCost: 1_200,
    hardwareBand: 5,
    maxRamPurchases: 10,
    maxGpuPurchases: 10,
    mrrMultiplier: 1,
  },
  campus: {
    id: 'campus',
    label: 'Tech Campus',
    tagline: 'Free kombucha. Pricy karma.',
    rent: 2_000,
    upgradeCost: 5_000,
    hardwareBand: 6,
    maxRamPurchases: 14,
    maxGpuPurchases: 14,
    mrrMultiplier: 1.1,
  },
  regional_dc: {
    id: 'regional_dc',
    label: 'Regional Data Center',
    tagline: 'The hum is productivity.',
    rent: 8_000,
    upgradeCost: 25_000,
    hardwareBand: 7,
    maxRamPurchases: 18,
    maxGpuPurchases: 18,
    mrrMultiplier: 1.15,
  },
  hyperscale_campus: {
    id: 'hyperscale_campus',
    label: 'Hyperscale Campus',
    tagline: 'Every building is a heat sink.',
    rent: 50_000,
    upgradeCost: 1e6,
    hardwareBand: 8,
    maxRamPurchases: 22,
    maxGpuPurchases: 22,
    mrrMultiplier: 1.2,
  },
  continental_grid: {
    id: 'continental_grid',
    label: 'Continental Grid',
    tagline: 'Nation-states colo. Nation-states cope.',
    rent: 500_000,
    upgradeCost: 1e9,
    hardwareBand: 9,
    maxRamPurchases: 28,
    maxGpuPurchases: 28,
    mrrMultiplier: 1.3,
  },
  planetary_backbone: {
    id: 'planetary_backbone',
    label: 'Planetary Backbone',
    tagline: 'Every continent, one lease.',
    rent: 5e6,
    upgradeCost: 1e12,
    hardwareBand: 10,
    maxRamPurchases: 35,
    maxGpuPurchases: 35,
    mrrMultiplier: 1.4,
  },
  orbital_ring: {
    id: 'orbital_ring',
    label: 'Orbital Ring',
    tagline: 'Latency: 8 minutes. Vibes: immaculate.',
    rent: 5e9,
    upgradeCost: 1e18,
    hardwareBand: 11,
    maxRamPurchases: 45,
    maxGpuPurchases: 45,
    mrrMultiplier: 1.5,
  },
  dyson_swarm: {
    id: 'dyson_swarm',
    label: 'Dyson Swarm',
    tagline: 'Partial stellar enclosure. Full tax write-off.',
    rent: 5e15,
    upgradeCost: 1e24,
    hardwareBand: 12,
    maxRamPurchases: 60,
    maxGpuPurchases: 60,
    mrrMultiplier: 1.75,
  },
  dyson_sphere: {
    id: 'dyson_sphere',
    label: 'Dyson Sphere',
    tagline: 'You ARE the power bill.',
    rent: 5e21,
    upgradeCost: 3e33,
    hardwareBand: 13,
    maxRamPurchases: 80,
    maxGpuPurchases: 80,
    mrrMultiplier: 2,
  },
}

export function nextHousingTier(current: ApartmentTier): ApartmentTier | null {
  const idx = HOUSING_ORDER.indexOf(current)
  if (idx < 0 || idx >= HOUSING_ORDER.length - 1) return null
  return HOUSING_ORDER[idx + 1]
}

export function housingMeetsRequirement(current: ApartmentTier, required: ApartmentTier): boolean {
  return HOUSING_ORDER.indexOf(current) >= HOUSING_ORDER.indexOf(required)
}

export function isSingularityEligible(apartment: ApartmentTier, customerHallucinationLevel: number): boolean {
  return apartment === 'dyson_sphere' && customerHallucinationLevel >= 3
}
