import { describe, expect, it } from 'vitest'
import { countRosterIdleAgents } from '../mechanics'
import type { Agent } from '../types'

describe('roster-idle-excludes-conductor', () => {
  it('does not count a conducting conductor as roster idle', () => {
    const conductor: Agent = {
      id: 'conductor-1',
      name: 'Conductor',
      personality: 'testy',
      job: 'conductor',
      projectId: 'proj-1',
      taskId: null,
      status: 'conducting',
      contextUsed: 0,
      compactingRemainingSec: 0,
      jobProgress: 0,
      jobDuration: 0,
      uptime: 0,
      isAutomation: false,
    }
    const idleCoder: Agent = {
      id: 'coder-1',
      name: 'Coder',
      personality: 'testy',
      job: 'code',
      projectId: 'proj-1',
      taskId: null,
      status: 'idle',
      contextUsed: 0,
      compactingRemainingSec: 0,
      jobProgress: 0,
      jobDuration: 0,
      uptime: 0,
      isAutomation: false,
    }

    expect(countRosterIdleAgents([conductor, idleCoder])).toBe(1)
  })
})
