import { describe, expect, it } from 'vitest'
import { adjustRoleCountMsg, buyVibingCourseMsg, timeElapsed } from '../messages'
import {
  refineRequirementToTasks,
  taskLifecycleLabel,
  taskNeedsRefinement,
} from '../projects'
import { ctxFrom } from '../simulation/simCtx'
import type { Agent, GameState, Requirement, Task } from '../types'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'

function refinableTask(projectId: string, requirementId: string, overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-leak',
    projectId,
    requirementId,
    title: 'Leaky task',
    storyPointsRequired: 2,
    storyPointsEarned: 0,
    complexity: 2,
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
    refinePassesRemaining: 2,
    ...overrides,
  }
}

function assertNoPrReadyWhileRefining(state: GameState, label: string) {
  const project = state.projects[0]!
  for (const task of project.tasks.filter((t) => !t.isReviewComment)) {
    if (taskNeedsRefinement(task)) {
      expect(task.status, `${label}: ${task.title}`).not.toBe('pr_ready')
      expect(taskLifecycleLabel(task, project), `${label}: ${task.title}`).toBe('refining')
    }
  }
}

describe('refine-passes-before-coding', () => {
  it('keeps unsplit requirement tasks in refining until tier passes are exhausted', () => {
    const state = initialPlaying()
    const project = state.projects[0]!
    const requirement: Requirement = {
      id: 'req-5',
      projectId: project.id,
      title: 'Big feature',
      storyPoints: 5,
      status: 'open',
      refinePassesUsed: 0,
    }
    const ctx = ctxFrom({
      ...state,
      vibingCourseTiers: { refinement: 2 },
    } as GameState)

    const tasks = refineRequirementToTasks(ctx, requirement, {
      refinementTier: 2,
      forceSingle: true,
    })

    expect(tasks).toHaveLength(1)
    const task = tasks[0]!
    expect(task.refinePassesRemaining).toBe(2)
    expect(taskNeedsRefinement(task)).toBe(true)
    expect(taskLifecycleLabel(task, { ...project, tasks: [task] })).toBe('refining')
    expect(task.status).not.toBe('pr_ready')
  })

  it('still requires refinement after partial coding progress if passes remain', () => {
    const project = initialPlaying().projects[0]!
    const task = refinableTask(project.id, project.requirements[0]!.id, {
      storyPointsEarned: 1,
      status: 'in_progress',
    })

    expect(taskNeedsRefinement(task)).toBe(true)
    expect(taskLifecycleLabel(task, { ...project, tasks: [task] })).toBe('refining')
  })

  it('does not jump tasks to review when all requirements are refined', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const ready: GameState = {
      ...base,
      vibingCourseTiers: { refinement: 2 },
      agents: base.agents.map((a) => ({
        ...a,
        contextUsed: 0,
        compactingRemainingSec: 0,
        status: 'refining' as const,
      })),
      projects: [
        {
          ...project,
          roleCounts: { refine: 1, code: 0, review: 0, test: 0, conductor: 0 },
        },
      ],
    }

    let state: GameState = ready
    for (let tick = 0; tick < 200; tick++) {
      state = dispatchChain(state, [timeElapsed(T0 + tick * 5, 5)])
      const current = state.projects[0]!
      const allRequirementsRefined = current.requirements.every((r) => r.status !== 'open')
      if (!allRequirementsRefined) continue

      const shippable = current.tasks.filter((t) => !t.isReviewComment)
      expect(shippable.length).toBeGreaterThan(0)
      for (const task of shippable) {
        expect(task.status).not.toBe('pr_ready')
        expect(taskLifecycleLabel(task, current)).not.toBe('review')
        if (taskNeedsRefinement(task)) {
          expect(taskLifecycleLabel(task, current)).toBe('refining')
        } else {
          expect(taskLifecycleLabel(task, current)).toBe('coding')
        }
      }
      return
    }

    throw new Error('requirements never finished refining')
  })

  it('does not let coders finish tasks that still have refine passes (including after last requirement)', () => {
    const base = stateWithCash(initialPlaying(42), 50_000)
    const project = base.projects[0]!
    const template = base.agents[0]!

    let state: GameState = {
      ...base,
      vibingCourseTiers: { refinement: 2 },
      agents: [
        ...base.agents.map((a) => ({
          ...a,
          contextUsed: 0,
          compactingRemainingSec: 0,
          status: 'refining' as const,
        })),
        {
          ...template,
          id: 'coder-2',
          job: null,
          projectId: null,
          status: 'idle',
          taskId: null,
          contextUsed: 0,
          compactingRemainingSec: 0,
        } as Agent,
      ],
      projects: [
        {
          ...project,
          roleCounts: { refine: 1, code: 2, review: 1, test: 0, conductor: 0 },
        },
      ],
    }

    state = dispatchChain(state, [
      adjustRoleCountMsg(T0 + 100, project.id, 'code', 1),
      adjustRoleCountMsg(T0 + 101, project.id, 'code', 1),
      adjustRoleCountMsg(T0 + 102, project.id, 'review', 1),
    ])

    let lastReqRefinedAt: number | null = null
    for (let tick = 0; tick < 2500; tick++) {
      state = dispatchChain(state, [timeElapsed(T0 + tick * 5, 5)])
      assertNoPrReadyWhileRefining(state, `tick=${tick}`)

      const current = state.projects[0]!
      if (current.requirements.every((r) => r.status !== 'open') && lastReqRefinedAt === null) {
        lastReqRefinedAt = tick
      }
      if (lastReqRefinedAt !== null && tick <= lastReqRefinedAt + 30) {
        assertNoPrReadyWhileRefining(state, `after-last-req tick=${tick}`)
      }
    }

    expect(lastReqRefinedAt).not.toBeNull()
  })

  it('keeps tier passes on tasks created before the last requirement is refined', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const tier = 2
    let state: GameState = {
      ...base,
      vibingCourseTiers: { refinement: tier },
      vibingCourses: ['refinement'],
      agents: base.agents.map((a) => ({
        ...a,
        contextUsed: 0,
        compactingRemainingSec: 0,
        status: 'refining' as const,
      })),
      projects: [
        {
          ...project,
          roleCounts: { refine: 1, code: 0, review: 0, test: 0, conductor: 0 },
        },
      ],
    }

    let snapshotAtLastReq: Map<string, number> | null = null

    for (let tick = 0; tick < 300; tick++) {
      const before = state.projects[0]!
      const openBefore = before.requirements.filter((r) => r.status === 'open').length

      state = dispatchChain(state, [timeElapsed(T0 + tick * 5, 5)])

      const after = state.projects[0]!
      if (openBefore === 1 && after.requirements.every((r) => r.status !== 'open')) {
        snapshotAtLastReq = new Map(
          after.tasks
            .filter((t) => !t.isReviewComment)
            .map((t) => [t.id, t.refinePassesRemaining ?? 0]),
        )
      }

      if (snapshotAtLastReq) {
        for (const task of after.tasks.filter((t) => !t.isReviewComment)) {
          const passesAtLast = snapshotAtLastReq.get(task.id)
          if (passesAtLast !== undefined) {
            expect(task.refinePassesRemaining ?? 0).toBe(passesAtLast)
          }
        }
      }
    }

    expect(snapshotAtLastReq).not.toBeNull()
  })

  it('applies refinement tier to requirements refined after buying the course mid-pipeline', () => {
    const base = stateWithCash(initialPlaying(99), 50_000)
    const project = base.projects[0]!
    let state: GameState = {
      ...base,
      agents: base.agents.map((a) => ({
        ...a,
        contextUsed: 0,
        compactingRemainingSec: 0,
        status: 'refining' as const,
      })),
      projects: [
        {
          ...project,
          roleCounts: { refine: 1, code: 1, review: 0, test: 0, conductor: 0 },
        },
      ],
    }

    state = dispatchChain(state, [adjustRoleCountMsg(T0 + 50, project.id, 'code', 1)])

    for (let tick = 0; tick < 400; tick++) {
      if (tick === 40) {
        state = dispatchChain(state, [
          buyVibingCourseMsg(T0 + tick * 5, 'refinement'),
          buyVibingCourseMsg(T0 + tick * 5 + 1, 'refinement'),
        ])
      }
      state = dispatchChain(state, [timeElapsed(T0 + tick * 5, 5)])
      assertNoPrReadyWhileRefining(state, `mid-buy tick=${tick}`)
    }
  })
})
