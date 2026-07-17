import { describe, expect, it } from 'vitest'
import { parsePersistedSave } from '../../runtime/persist'
import { clientSlotsNeedingLeads } from '../mechanics'
import { advanceUntilLeadSpawns } from './_helpers/advanceGameDays'
import { createDefaultMeta } from '../meta'
import { T0 } from './_helpers/testConstants'

describe('import-save-without-lead-slot-index', () => {
  it('repairs legacy leads missing slotIndex instead of producing NaN', () => {
    const imported = parsePersistedSave({
      version: 15,
      meta: createDefaultMeta(),
      state: {
        phase: 'playing',
        cash: 0,
        reputation: 0,
        gameDay: 0,
        rentDueInDays: 30,
        apartment: 'cardboard',
        apartmentLeaseRemaining: 30,
        agentSlotPurchases: 0,
        gpuTickPurchases: 0,
        mrr: 0,
        productFeaturesShipped: 0,
        purchasedFineTunes: [],
        fineTuneTiers: {},
        vibingCourses: [],
        vibingCourseTiers: {},
        assignedSpecialistRoles: [],
        agents: [],
        projects: [],
        productBacklog: [],
        leads: [
          {
            id: 'lead-1',
            clientName: 'Legacy Lead',
            clientTagline: 'No slot index',
            blurb: 'Imported from an old save.',
            payment: 100,
            durationDays: 10,
            totalStoryPoints: 5,
            spawnedGameDay: 0,
            status: 'available',
            repRequired: 0,
            source: 'real',
          },
        ],
        selectedTaskId: null,
        tutorialDone: true,
        seenStoryIntro: true,
        acknowledgedTutorialStep: -1,
        seenTabIntros: [],
        seenCompactionIntro: false,
        syntheticLeadCooldown: 4,
        taxCodeCooldown: 10,
        events: [],
        stats: {
          projectsCompleted: 0,
          tasksMerged: 0,
          agentsDeployed: 0,
          compactionsSurvived: 0,
          productsShipped: 0,
          syntheticLeadsAccepted: 0,
        },
        snapshotAt: T0,
        rng: 1,
        nextId: 2,
        conductorStaffQueueCursor: 0,
      },
    })
    expect(imported).not.toBeNull()

    const lead = imported!.leads.find((l) => l.status === 'available')
    expect(lead?.slotIndex).toBe(0)
    expect(Number.isNaN(lead?.slotIndex)).toBe(false)

    const after = advanceUntilLeadSpawns(imported!, T0 + 5000)
    expect(clientSlotsNeedingLeads(after, after.projects, after.leads)).not.toContain(NaN)
  })
})
