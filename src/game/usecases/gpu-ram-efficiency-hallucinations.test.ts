import { describe, expect, it } from 'vitest'
import { BASE_GPU_TICKS } from '../constants'
import {
  effectiveGpuTicks,
  getAgentRamParams,
  gpuShareForAgents,
  totalGpuTicks,
} from '../mechanics'
import {
  gpuEfficiencyHallucinationMultiplier,
  hallucinationUpgradeCost,
  ramEfficiencyHallucinationMultiplier,
} from '../prestige'
import { createDefaultMeta, setHallucinationLevel } from '../meta'
import { initialPlaying } from './_helpers/initialPlaying'
import type { Agent } from '../types'

describe('gpu-ram-efficiency-hallucinations', () => {
  it('charges 2, 4, 8, and 16 points for gpu efficiency levels', () => {
    expect(hallucinationUpgradeCost('gpu_efficiency', 0)).toBe(2)
    expect(hallucinationUpgradeCost('gpu_efficiency', 1)).toBe(4)
    expect(hallucinationUpgradeCost('gpu_efficiency', 2)).toBe(8)
    expect(hallucinationUpgradeCost('gpu_efficiency', 3)).toBe(16)
  })

  it('charges 2, 4, 8, 16, and 32 points for ram efficiency levels', () => {
    expect(hallucinationUpgradeCost('ram_efficiency', 0)).toBe(2)
    expect(hallucinationUpgradeCost('ram_efficiency', 1)).toBe(4)
    expect(hallucinationUpgradeCost('ram_efficiency', 2)).toBe(8)
    expect(hallucinationUpgradeCost('ram_efficiency', 3)).toBe(16)
    expect(hallucinationUpgradeCost('ram_efficiency', 4)).toBe(32)
  })

  it('adds +0.25 effective GPU multiplier per level up to 4', () => {
    const meta = setHallucinationLevel(createDefaultMeta(), 'gpu_efficiency', 2)
    expect(gpuEfficiencyHallucinationMultiplier(meta)).toBe(1.5)

    const maxed = setHallucinationLevel(createDefaultMeta(), 'gpu_efficiency', 4)
    expect(gpuEfficiencyHallucinationMultiplier(maxed)).toBe(2)
  })

  it('scales owned GPU ticks by the efficiency multiplier', () => {
    let state = {
      ...initialPlaying(),
      tutorialDone: true,
      gpuTickPurchases: 3,
      meta: setHallucinationLevel(createDefaultMeta(), 'gpu_efficiency', 2),
    }

    expect(totalGpuTicks(state)).toBe(BASE_GPU_TICKS + 3)
    expect(effectiveGpuTicks(state)).toBe((BASE_GPU_TICKS + 3) * 1.5)
  })

  it('increases per-agent GPU share via effective tick count', () => {
    const agents = [{ job: 'code' }, { job: 'code' }] as Agent[]
    const state = {
      ...initialPlaying(),
      tutorialDone: true,
      gpuTickPurchases: 3,
      meta: setHallucinationLevel(createDefaultMeta(), 'gpu_efficiency', 2),
    }

    const baseShare = gpuShareForAgents(agents, totalGpuTicks(state))
    const boostedShare = gpuShareForAgents(agents, effectiveGpuTicks(state))
    expect(boostedShare / baseShare).toBeCloseTo(1.5)
  })

  it('subtracts 0.1 from RAM multiplier per level up to 5', () => {
    const meta = setHallucinationLevel(createDefaultMeta(), 'ram_efficiency', 2)
    expect(ramEfficiencyHallucinationMultiplier(meta)).toBeCloseTo(0.8)

    const maxed = setHallucinationLevel(createDefaultMeta(), 'ram_efficiency', 5)
    expect(ramEfficiencyHallucinationMultiplier(maxed)).toBeCloseTo(0.5)
  })

  it('reduces model RAM footprint without changing throughput params', () => {
    const meta = setHallucinationLevel(createDefaultMeta(), 'ram_efficiency', 2)
    expect(getAgentRamParams(meta)).toBeCloseTo(3.2)
  })
})
