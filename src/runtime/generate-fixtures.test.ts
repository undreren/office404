import { describe, it, expect } from 'vitest'
import { tutorialReadyForCodeFixture } from './fixture-builders'

describe('fixture builders', () => {
  it('tutorial-ready-for-code has tasks and staffable agents', () => {
    const state = tutorialReadyForCodeFixture()
    const project = state.projects[0]!
    expect(project.tasks.length).toBeGreaterThan(0)
    expect(project.requirements.every((r) => r.status === 'refined')).toBe(true)
    expect(state.agents.some((a) => a.job === null)).toBe(true)
    expect(state.agents.every((a) => a.job === null)).toBe(true)
  })
})
