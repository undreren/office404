import { describe, expect, it } from 'vitest'
import { hydrateFromSave } from '../messages'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { dispatchChain } from './_helpers/dispatchChain'
import { T0 } from './_helpers/testConstants'

describe('hydrate-from-save-restores-state', () => {
  it('matches use case invariants', () => {
    const saved = stateWithCash(initialPlaying(), 750)
    saved.projects = [...saved.projects, { ...saved.projects[0]!, id: 'proj-saved-copy' }]

    const state = dispatchChain(initialPlaying(), [hydrateFromSave(saved, T0 + 5000)])

    expect(state.cash).toBe(750)
    expect(state.projects).toHaveLength(2)
    expect(state.snapshotAt).toBe(T0 + 5000)
  })
})
