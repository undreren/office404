import { describe, expect, it } from 'vitest'
import { JUST_MERGE_PR_QUALITY } from '../constants'
import { timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Task } from '../types'

// Pinned seed 1: just-merge prQuality 20 and bug roll succeeds at QA.
const BUG_SEED = 1

describe('bug-at-qa-creates-fix-task', () => {
  it('matches use case invariants', () => {
    const base = initialPlaying(BUG_SEED)
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task: Task = {
      id: 'task-bug',
      projectId: project.id,
      requirementId: req.id,
      title: 'Bug target',
      storyPointsRequired: 2,
      storyPointsEarned: 2,
      complexity: 2,
      refined: true,
      status: 'merged',
      assignedAgentId: null,
      completedByAgentId: 'agt-x',
      parentTaskId: null,
      prQuality: JUST_MERGE_PR_QUALITY,
      prQualityStaging: JUST_MERGE_PR_QUALITY,
      hasUndiscoveredBug: false,
      bugDiscovered: false,
      isBugFix: false,
      sourceTaskId: null,
      isReviewComment: false,
      reviewed: true,
      testStoryPointsEarned: 0,
    }
    let state = {
      ...base,
      projects: [
        {
          ...project,
          requirements: project.requirements.map((r) => ({ ...r, status: 'refined' as const })),
          tasks: [task],
          testStoryPointsRequired: 2,
          testStoryPointsCompleted: 0,
          roleCounts: { refine: 0, code: 0, review: 0, test: 1, conductor: 0 },
        },
      ],
      agents: base.agents.map((a) => ({
        ...a,
        job: 'test' as const,
        projectId: project.id,
        status: 'testing' as const,
        taskId: task.id,
        contextUsed: 0,
        compactingRemainingSec: 0,
      })),
    }

    for (let tick = 0; tick < 500; tick++) {
      state = dispatchChain(state, [timeElapsed(T0 + tick * 10, 10)])
      const current = state.projects[0]!.tasks.find((t) => t.id === task.id)!
      if (current.testStoryPointsEarned >= current.storyPointsRequired) break
    }

    const source = state.projects[0]!.tasks.find((t) => t.id === task.id)!
    const fixTasks = state.projects[0]!.tasks.filter((t) => t.isBugFix)

    expect(source.prQuality).toBe(JUST_MERGE_PR_QUALITY)
    expect(source.bugDiscovered).toBe(true)
    expect(fixTasks.length).toBeGreaterThan(0)
  })
})
