import { describe, expect, it } from 'vitest'
import { SECONDS_PER_GAME_DAY, TICK_INTERVAL_MS } from '../constants'
import {
  adjustRoleCountMsg,
  buyAgentSlotMsg,
  buyVibingCourseMsg,
  hydrateFromSave,
  timeElapsed,
} from '../messages'
import { derangeText, unhingedPrefix, unhingedTier } from '../unhinged'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithAcceptedProject } from './_helpers/stateWithAcceptedProject'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'

describe('unhinged-event-messages', () => {
  it('derangeText tolerates negative rng seeds without undefined spam', () => {
    const message =
      'Prompt-Engineered the Slack Bot refined "On-call runbook longer than "good luck"" into "Analytics tracking pageviews from bots and your mom" (1 SP).'
    const deranged = derangeText(message, 1, -121_873_038)
    expect(deranged).not.toContain('undefined')
    expect(deranged.length).toBeGreaterThan(20)
  })

  it('derangeText ignores non-string input', () => {
    const sparse = Array.from({ length: 50 })
    expect(derangeText(sparse as unknown as string, 1, 0)).toBe('')
  })

  it('keeps incident log readable after long play with hallucinations earned', () => {
    let state = stateWithAcceptedProject()
    state = {
      ...state,
      meta: { ...state.meta, totalHallucinationsEarned: 3 },
      cash: 5000,
    }
    state = dispatchChain(state, [
      buyAgentSlotMsg(T0 + 100),
      buyAgentSlotMsg(T0 + 200),
      buyAgentSlotMsg(T0 + 300),
      buyVibingCourseMsg(T0 + 400, 'context_optimization'),
      adjustRoleCountMsg(T0 + 500, state.projects[0]!.id, 'refine', 1),
      adjustRoleCountMsg(T0 + 600, state.projects[0]!.id, 'code', 1),
      adjustRoleCountMsg(T0 + 700, state.projects[0]!.id, 'review', 1),
      adjustRoleCountMsg(T0 + 800, state.projects[0]!.id, 'test', 1),
    ])

    const tickSec = TICK_INTERVAL_MS / 1000
    const ticks = Math.ceil((SECONDS_PER_GAME_DAY * 20) / tickSec)
    for (let i = 0; i < ticks; i++) {
      state = dispatchChain(state, [timeElapsed(T0 + 1000 + i, tickSec)])
    }

    expect(state.gameDay).toBeGreaterThan(15)
    expect(state.events.length).toBeGreaterThan(0)
    for (const event of state.events) {
      expect(event.message).not.toContain('undefinedundefined')
      expect(event.message.length).toBeLessThan(500)
    }
  })

  it('keeps hydrated offline catch-up events readable with unhinged tier active', () => {
    const saved = stateWithCash(stateWithAcceptedProject(), 3000)
    saved.meta.totalHallucinationsEarned = 2
    saved.vibingCourses = ['offline']
    saved.gameDay = 10
    saved.events = [
      {
        id: 'evt-1',
        timestamp: T0,
        type: 'project',
        message: `${unhingedPrefix(unhingedTier(2))}${derangeText('Shipped tutorial gig.', 2, saved.rng)}`,
      },
    ]

    const state = dispatchChain(initialPlaying(), [
      hydrateFromSave(saved, T0 + SECONDS_PER_GAME_DAY * 5 * 1000),
    ])

    for (const message of state.events.map((e) => e.message)) {
      expect(message).not.toContain('undefinedundefined')
    }
  })
})
