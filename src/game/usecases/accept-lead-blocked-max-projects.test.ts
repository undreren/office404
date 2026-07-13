import { describe, expect, it } from 'vitest'
import { maxClientProjectSlots } from '../prestige'
import { acceptLeadMsg, stateChanged } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { stateWithAvailableLead } from './_helpers/stateWithAvailableLead'
import { T0 } from './_helpers/testConstants'
import type { Project } from '../types'

function extraProject(index: number): Project {
  return {
    id: `proj-extra-${index}`,
    clientName: `Client ${index}`,
    clientTagline: 'Test',
    blurb: 'Test',
    payment: 100,
    durationDays: 20,
    daysRemaining: 20,
    deliveryQuality: 80,
    testPercent: 0,
    testStoryPointsRequired: 0,
    testStoryPointsCompleted: 0,
    totalStoryPoints: 5,
    status: 'active',
    requirements: [],
    tasks: [],
    isTutorial: false,
    kind: 'client',
    lateCount: 0,
    repPenaltyMultiplier: 1,
    crewCap: 4,
    roleCounts: { refine: 0, code: 0, review: 0, test: 0, conductor: 0 },
    useConductor: false,
    duplicateProjectId: null,
    mrrContribution: 0,
  }
}

describe('accept-lead-blocked-max-projects', () => {
  it('matches use case invariants', () => {
    const before = stateWithAvailableLead()
    const lead = before.leads.find((l) => l.status === 'available')!
    const maxSlots = maxClientProjectSlots(before.meta, before.vibingCourseTiers.project_manager ?? 0)
    const extras = Array.from({ length: maxSlots }, (_, i) => extraProject(i))
    const patched = { ...before, projects: extras }

    expect(patched.projects.filter((p) => p.status === 'active' && p.kind === 'client').length).toBe(
      maxSlots,
    )

    const after = dispatchChain(patched, [acceptLeadMsg(T0 + 3000, lead.id)])

    expect(stateChanged(patched, after)).toBe(false)
    expect(after.leads.find((l) => l.id === lead.id)?.status).toBe('available')
  })
})
