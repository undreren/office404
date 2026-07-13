import { describe, expect, it } from 'vitest'
import { deliverProjectMsg } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithDeliverableProject } from './_helpers/stateWithTutorialComplete'
import { generateLead } from '../projects'
import { ctxFrom } from '../simulation/simCtx'
import { T0 } from './_helpers/testConstants'

describe('lead-backfills-on-deliver', () => {
  it('spawns a lead immediately when delivery frees a slot and the inbox is empty', () => {
    const base = { ...initialPlaying(), tutorialDone: true, projects: [], leads: [] }
    const { state: ready, projectId } = stateWithDeliverableProject(base, 500)

    const state = dispatchChain(ready, [deliverProjectMsg(T0 + 1000, projectId)])

    expect(state.projects.some((p) => p.id === projectId)).toBe(false)
    expect(state.leads.filter((l) => l.status === 'available')).toHaveLength(1)
  })

  it('does not spawn an extra lead when the inbox already matches empty slots', () => {
    const base = { ...initialPlaying(), tutorialDone: true, projects: [] }
    const ctx = ctxFrom(base)
    const waitingLead = generateLead(ctx, base.reputation, base.gameDay)
    const withLead = {
      ...base,
      leads: [{ ...waitingLead, daysToExpire: 30 }],
    }
    const { state: ready, projectId } = stateWithDeliverableProject(withLead, 500)

    const state = dispatchChain(ready, [deliverProjectMsg(T0 + 1000, projectId)])

    expect(state.leads.filter((l) => l.status === 'available')).toHaveLength(1)
    expect(state.leads[0]?.id).toBe(waitingLead.id)
  })
})
