import { describe, expect, it } from 'vitest'
import { getAgentParameters } from '../mechanics'
import { createDefaultMeta, setHallucinationLevel } from '../meta'

describe('code-hallucination-coding-params', () => {
  it('boosts coding params by 10% per level', () => {
    const meta = setHallucinationLevel(createDefaultMeta(), 'code', 2)
    const base = getAgentParameters(meta, [], 'refine', 0)
    const coding = getAgentParameters(meta, [], 'code', 0)
    expect(coding / base).toBeCloseTo(1.2)
  })

  it('stacks multiplicatively with cash fine-tunes', () => {
    const meta = setHallucinationLevel(createDefaultMeta(), 'code', 2)
    const tuned = getAgentParameters(meta, ['tune-0-code'], 'code', 0)
    const plain = getAgentParameters(meta, [], 'code', 0)
    expect(tuned / plain).toBeCloseTo(1.12)
  })
})
