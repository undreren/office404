import { describe, expect, it } from 'vitest'
import { accountingPaymentMultiplier, customerNegotiateMultiplier, marketingScopeMultiplier } from '../hallucinationAutomation'
import type { AutomationAgentJob } from '../mechanics'
import { createDefaultMeta, setHallucinationLevel } from '../meta'
import type { Agent } from '../types'

function automationAgent(job: AutomationAgentJob): Agent {
  return {
    id: `auto-${job}`,
    name: 'Bot',
    personality: 'Chill',
    job,
    projectId: null,
    taskId: null,
    status: 'idle',
    jobProgress: 0,
    jobDuration: 0,
    contextUsed: 0,
    compactingRemainingSec: 0,
    uptime: 0,
    isAutomation: true,
    automationJob: job,
  }
}

describe('hallucination-specialist-effects', () => {
  it('boosts lead scope when marketing specialist is assigned', () => {
    const meta = setHallucinationLevel(createDefaultMeta(), 'marketing', 2)
    const agents = [automationAgent('marketing')]
    expect(marketingScopeMultiplier(meta, agents)).toBe(1.2)
    expect(marketingScopeMultiplier(meta, [])).toBe(1)
  })

  it('scales customer negotiate and accounting payout multipliers with level', () => {
    const meta = setHallucinationLevel(setHallucinationLevel(createDefaultMeta(), 'customer', 2), 'accounting', 3)
    const customerAgents = [automationAgent('customer')]
    const accountingAgents = [automationAgent('accounting')]
    expect(customerNegotiateMultiplier(meta, customerAgents)).toBe(1.2)
    expect(accountingPaymentMultiplier(meta, accountingAgents)).toBe(1.15)
    expect(customerNegotiateMultiplier(meta, [])).toBe(1)
    expect(accountingPaymentMultiplier(meta, [])).toBe(1)
  })
})
