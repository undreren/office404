import { describe, expect, it } from 'vitest'
import { buyAgentSlotMsg, buyVibingCourseMsg, hydrateFromSave, returnFromHiddenMsg, syncOfflineSpecialistMsg } from '../messages'
import { SECONDS_PER_GAME_DAY } from '../constants'
import { VIBING_COURSES } from '../upgrades'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'

describe('offline-agent-course', () => {
  const course = VIBING_COURSES.find((c) => c.id === 'offline')!

  it('lists the Offline Agent course at $1000 with the relativity tagline', () => {
    expect(course.label).toBe('Offline Agent')
    expect(course.cost).toBe(1000)
    expect(course.tagline).toBe('Special relativity, time can be hallucinated.')
  })

  it('enrolls in the course and unlocks the offline specialist role', () => {
    const before = stateWithCash(initialPlaying(), 1500)
    const state = dispatchChain(before, [buyVibingCourseMsg(T0 + 1000, 'offline')])

    expect(state.vibingCourses).toContain('offline')
    expect(state.cash).toBe(500)
    expect(state.assignedSpecialistRoles).not.toContain('offline')
  })

  it('does not apply offline catch-up without the course', () => {
    const saved = stateWithCash(initialPlaying(), 500)
    saved.gameDay = 1

    const state = dispatchChain(initialPlaying(), [hydrateFromSave(saved, T0 + SECONDS_PER_GAME_DAY * 1000)])

    expect(state.gameDay).toBe(1)
    expect(state.events.some((e) => e.message.includes('Offline Agent'))).toBe(false)
  })

  it('applies capped offline catch-up on hydrate when the course is owned', () => {
    const saved = stateWithCash(initialPlaying(), 500)
    saved.vibingCourses = ['offline']
    saved.gameDay = 1

    const state = dispatchChain(initialPlaying(), [
      hydrateFromSave(saved, T0 + SECONDS_PER_GAME_DAY * 1000),
    ])

    expect(state.gameDay).toBeGreaterThanOrEqual(1)
    expect(state.events.some((e) => e.message.includes('Offline Agent hallucinated the elapsed time'))).toBe(
      true,
    )
  })

  it('auto-assigns the offline specialist when the tab hides and frees it on return', () => {
    const before = stateWithCash(initialPlaying(), 2000)
    const withSlot = dispatchChain(before, [buyAgentSlotMsg(T0 + 500)])
    const enrolled = dispatchChain(withSlot, [buyVibingCourseMsg(T0 + 1000, 'offline')])

    const hidden = dispatchChain(enrolled, [syncOfflineSpecialistMsg(T0 + 2000, true)])
    expect(hidden.assignedSpecialistRoles).toContain('offline')
    expect(hidden.agents.some((a) => a.isAutomation && a.automationJob === 'offline')).toBe(true)

    const visible = dispatchChain(hidden, [returnFromHiddenMsg(T0 + 8000, 60)])
    expect(visible.assignedSpecialistRoles).not.toContain('offline')
    expect(visible.agents.some((a) => a.automationJob === 'offline')).toBe(false)
  })
})
