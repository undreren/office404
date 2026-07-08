import type { Vendor } from './types'

export const VENDORS: Record<string, Vendor> = {
  anthropomorphic: {
    id: 'anthropomorphic',
    name: 'Anthropomorphic',
    tagline: 'We put the "human" in "inhuman pricing."',
    tokenCostPerSec: 2.4,
    deployCost: 120,
    outputMultiplier: 1.8,
    crashChance: 0.0008,
    stubbornChance: 0.02,
  },
  obstinate: {
    id: 'obstinate',
    name: 'ObstinateAI',
    tagline: 'Your problem. Our terms of service.',
    tokenCostPerSec: 0.9,
    deployCost: 45,
    outputMultiplier: 0.7,
    crashChance: 0.0003,
    stubbornChance: 0.12,
  },
  precursor: {
    id: 'precursor',
    name: 'PreCursor',
    tagline: 'Ship fast. Crash faster. Tab-complete your regrets.',
    tokenCostPerSec: 1.5,
    deployCost: 75,
    outputMultiplier: 2.4,
    crashChance: 0.0025,
    stubbornChance: 0.04,
  },
}

export const VENDOR_LIST = Object.values(VENDORS)
