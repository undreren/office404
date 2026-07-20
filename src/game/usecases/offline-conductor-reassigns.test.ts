import { describe, expect, it } from 'vitest'
import { catchUpOfflineMsg, buyVibingCourseMsg, timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'
import type { Agent, GameState } from '../types'

function conductorOfflineState(): GameState {
  const base = stateWithCash(initialPlaying(), 3000)
  const enrolled = dispatchChain(base, [
    buyVibingCourseMsg(T0 + 500, 'offline'),
    buyVibingCourseMsg(T0 + 600, 'conductor'),
  ])
  const project = enrolled.projects[0]!
  const template = enrolled.agents[0]!
  const conductor: Agent = {
    ...template,
    id: 'conductor-1',
    job: 'conductor',
    projectId: project.id,
    status: 'conducting',
    taskId: null,
    contextUsed: 0,
    compactingRemainingSec: 0,
  }
  const coderA: Agent = {
    ...template,
    id: 'coder-a',
    job: 'code',
    projectId: project.id,
    status: 'idle',
    taskId: null,
    contextUsed: 0,
    compactingRemainingSec: 0,
  }
  const coderB: Agent = {
    ...template,
    id: 'coder-b',
    job: 'code',
    projectId: project.id,
    status: 'idle',
    taskId: null,
    contextUsed: 0,
    compactingRemainingSec: 0,
  }

  return {
    ...enrolled,
    projects: [
      {
        ...project,
        useConductor: true,
        roleCounts: { refine: 0, code: 2, review: 0, test: 0, conductor: 1 },
        requirements: [
          { ...project.requirements[0]!, status: 'open' },
          ...project.requirements.slice(1).map((r) => ({ ...r, status: 'refined' as const })),
        ],
        tasks: [
          {
            id: 'task-1',
            projectId: project.id,
            requirementId: project.requirements[1]!.id,
            title: 'Shippable chunk',
            storyPointsRequired: 1,
            storyPointsEarned: 0,
            complexity: 1,
            refined: true,
            status: 'open',
            assignedAgentId: null,
            completedByAgentId: null,
            parentTaskId: null,
            prQuality: null,
            prQualityStaging: 0,
            hasUndiscoveredBug: false,
            bugDiscovered: false,
            isBugFix: false,
            sourceTaskId: null,
            isReviewComment: false,
            reviewed: false,
            testStoryPointsEarned: 0,
            refinePassesRemaining: 0,
          },
        ],
      },
    ],
    agents: [conductor, coderA, coderB],
    snapshotAt: T0,
  }
}

function conductorMidAwayState(): GameState {
  const base = conductorOfflineState()
  const project = base.projects[0]!
  const template = base.agents[0]!
  const workingCoder: Agent = {
    ...template,
    id: 'coder-working',
    job: 'code',
    projectId: project.id,
    status: 'working',
    taskId: 'task-1',
    contextUsed: 0,
    compactingRemainingSec: 0,
  }
  return {
    ...base,
    projects: [
      {
        ...project,
        roleCounts: { refine: 0, code: 1, review: 0, test: 0, conductor: 1 },
      },
    ],
    agents: [
      base.agents.find((a) => a.job === 'conductor')!,
      workingCoder,
    ],
  }
}

describe('offline-conductor-reassigns', () => {
  it('reassigns idle coders to refine during offline catch-up', () => {
    const awaySec = 5
    const before = conductorOfflineState()

    const live = dispatchChain(before, Array.from({ length: awaySec }, (_, i) => timeElapsed(T0 + 1000 + i, 1)))
    const offline = dispatchChain(before, [catchUpOfflineMsg(T0 + awaySec * 1000)])

    const liveRefine = live.agents.filter((a) => a.projectId === before.projects[0]!.id && a.job === 'refine').length
    const offlineRefine = offline.agents.filter(
      (a) => a.projectId === before.projects[0]!.id && a.job === 'refine',
    ).length

    expect(liveRefine).toBeGreaterThan(0)
    expect(offlineRefine).toBe(liveRefine)
  })

  it('keeps reassigning after a coder finishes work mid-away', () => {
    const awaySec = 60
    const before = conductorMidAwayState()

    const live = dispatchChain(before, Array.from({ length: awaySec }, (_, i) => timeElapsed(T0 + 1000 + i, 1)))
    const offline = dispatchChain(before, [catchUpOfflineMsg(T0 + awaySec * 1000)])
    const lumped = dispatchChain(before, [timeElapsed(T0 + awaySec * 1000, awaySec)])

    const liveOpenReqs = live.projects[0]!.requirements.filter((r) => r.status === 'open').length
    const offlineOpenReqs = offline.projects[0]!.requirements.filter((r) => r.status === 'open').length
    const lumpedOpenReqs = lumped.projects[0]!.requirements.filter((r) => r.status === 'open').length

    expect(liveOpenReqs).toBeLessThan(before.projects[0]!.requirements.filter((r) => r.status === 'open').length)
    expect(offlineOpenReqs).toBe(liveOpenReqs)
    expect(lumpedOpenReqs).toBeGreaterThan(liveOpenReqs)
  })

  it('leaves conductor able to auto-staff after offline catch-up', () => {
    const awaySec = 60
    const before = conductorOfflineState()
    const after = dispatchChain(before, [catchUpOfflineMsg(T0 + awaySec * 1000)])
    const conductor = after.agents.find((a) => a.job === 'conductor')!
    const openBefore = before.projects[0]!.requirements.filter((r) => r.status === 'open').length
    const openAfter = after.projects[0]!.requirements.filter((r) => r.status === 'open').length
    const compactingWorkers = after.agents.filter(
      (a) => a.projectId === before.projects[0]!.id && a.status === 'compacting',
    ).length

    expect(conductor.status).not.toBe('compacting')
    expect(conductor.status).not.toBe('crashed')
    expect(compactingWorkers).toBe(0)
    expect(openAfter).toBeLessThan(openBefore)

    const next = dispatchChain(after, [timeElapsed(T0 + awaySec * 1000 + 1000, 1)])
    const conductorNext = next.agents.find((a) => a.job === 'conductor')!
    expect(conductorNext.status).toBe('conducting')
  })
})
