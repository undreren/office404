import { describe, expect, it } from 'vitest'
import { REP_ZERO_MAX_TASK_SP } from '../constants'
import { advanceUntilLeadSpawns } from './_helpers/advanceGameDays'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'

describe('rep-zero-spawns-crappy-leads', () => {
  it('matches use case invariants', () => {
    const before = {
      ...initialPlaying(),
      tutorialDone: true,
      reputation: 0,
      projects: [],
      agents: [],
    }

    const state = advanceUntilLeadSpawns(before, T0 + 1000)

    expect(state.phase).toBe('playing')
    const lead = state.leads.find((l) => l.status === 'available')
    expect(lead).toBeDefined()
    expect(lead!.totalStoryPoints).toBeLessThanOrEqual(REP_ZERO_MAX_TASK_SP * 2)
  })
})
