import {
  adjustRoleCountMsg,
  deliverProjectMsg,
  justMergePrMsg,
  mergePrMsg,
} from '../../messages'
import { taskTokensRequired } from '../../mechanics'
import { isReadyToDeliver } from '../../simulation/gameLogic'
import type { GameState } from '../../types'
import { fullyShippableTask } from './taskTokens'
import { advanceGameDays } from './advanceGameDays'
import { dispatchChain } from './dispatchChain'
import { stateWithPrReady } from './stateWithRefinedTasks'
import { SEED, T0 } from './testConstants'

/** Tutorial project ready to deliver (all tasks merged and tested). */
export function stateWithTutorialComplete(seed: number = SEED): GameState {
  let state = stateWithPrReady(seed)
  const project = state.projects[0]!

  state = dispatchChain(state, [
    adjustRoleCountMsg(T0 + 60_000, project.id, 'code', -1),
    adjustRoleCountMsg(T0 + 61_000, project.id, 'review', 1),
  ])

  for (let day = 1; day <= 20; day++) {
    state = advanceGameDays(state, 1, T0 + 70_000 + day * 1000)
    const prTask = state.projects[0]!.tasks.find((t) => t.status === 'pr_ready')
    if (prTask?.reviewed) {
      state = dispatchChain(state, [mergePrMsg(T0 + 80_000, prTask.id)])
      break
    }
  }

  const mergedTasks = state.projects[0]!.tasks.filter(
    (t) => t.status === 'merged' && !t.isReviewComment,
  )
  for (const task of mergedTasks) {
    if (task.testStoryPointsEarned >= task.storyPointsRequired) continue
    state = dispatchChain(state, [
      adjustRoleCountMsg(T0 + 90_000, project.id, 'review', -1),
      adjustRoleCountMsg(T0 + 91_000, project.id, 'test', 1),
    ])
    for (let day = 1; day <= 30; day++) {
      state = advanceGameDays(state, 1, T0 + 100_000 + day * 1000)
      const current = state.projects[0]!.tasks.find((t) => t.id === task.id)
      if (current && current.testStoryPointsEarned >= current.storyPointsRequired) break
    }
  }

  // Refine remaining requirements and ship remaining tasks
  state = dispatchChain(state, [
    adjustRoleCountMsg(T0 + 110_000, project.id, 'test', -1),
    adjustRoleCountMsg(T0 + 111_000, project.id, 'refine', 1),
  ])

  for (let round = 0; round < 40; round++) {
    if (isReadyToDeliver(state.projects[0]!)) return state
    state = advanceGameDays(state, 2, T0 + 120_000 + round * 2000)

    const openTasks = state.projects[0]!.tasks.filter(
      (t) => !t.isReviewComment && t.status !== 'merged',
    )
    if (openTasks.length > 0 && !state.agents.some((a) => a.job === 'code')) {
      state = dispatchChain(state, [
        adjustRoleCountMsg(T0 + 130_000 + round, project.id, 'refine', -1),
        adjustRoleCountMsg(T0 + 131_000 + round, project.id, 'code', 1),
      ])
    }

    const prReady = state.projects[0]!.tasks.filter((t) => t.status === 'pr_ready')
    for (const pr of prReady) {
      if (!pr.reviewed && state.agents.some((a) => a.job === 'review')) {
        state = advanceGameDays(state, 3, T0 + 140_000 + round * 2000)
      }
      const updated = state.projects[0]!.tasks.find((t) => t.id === pr.id)
      if (updated?.status === 'pr_ready' && updated.reviewed) {
        state = dispatchChain(state, [mergePrMsg(T0 + 150_000 + round, pr.id)])
      } else if (updated?.status === 'pr_ready') {
        state = dispatchChain(state, [justMergePrMsg(T0 + 150_000 + round, pr.id)])
      }
    }

    const needsTest = state.projects[0]!.tasks.filter(
      (t) => t.status === 'merged' && t.testStoryPointsEarned < t.storyPointsRequired,
    )
    if (needsTest.length > 0 && !state.agents.some((a) => a.job === 'test')) {
      state = dispatchChain(state, [
        adjustRoleCountMsg(T0 + 160_000 + round, project.id, 'code', -1),
        adjustRoleCountMsg(T0 + 161_000 + round, project.id, 'test', 1),
      ])
    }
  }

  if (!isReadyToDeliver(state.projects[0]!)) {
    throw new Error('tutorial project not ready to deliver')
  }
  return state
}

/** Non-tutorial project patched to deliverable state with known payment. */
export function stateWithDeliverableProject(
  state: GameState,
  payment = 500,
): { state: GameState; projectId: string } {
  const projectId = 'proj-deliver-test'
  const reqId = 'req-deliver-test'
  const taskId = 'task-deliver-test'
  const testTok = taskTokensRequired(2, 'test')
  const project = {
    id: projectId,
    clientName: 'Test Client',
    clientTagline: 'Test',
    blurb: 'Test',
    payment,
    durationDays: 20,
    daysRemaining: 10,
    deliveryQuality: 80,
    testPercent: 100,
    testStoryPointsRequired: testTok,
    testStoryPointsCompleted: testTok,
    totalStoryPoints: 2,
    status: 'active' as const,
    requirements: [{ id: reqId, projectId, title: 'Req', storyPoints: 2, status: 'refined' as const, refinePassesUsed: 0 }],
    tasks: [
      fullyShippableTask({
        id: taskId,
        projectId,
        requirementId: reqId,
        title: 'Task',
        storyPointsRequired: 2,
        storyPointsEarned: 0,
        complexity: 2,
        refined: true,
        status: 'merged' as const,
        assignedAgentId: null,
        completedByAgentId: 'agt-x',
        parentTaskId: null,
        prQuality: 80,
        prQualityStaging: 80,
        hasUndiscoveredBug: false,
        bugDiscovered: false,
        isBugFix: false,
        sourceTaskId: null,
        isReviewComment: false,
        reviewed: true,
        testStoryPointsEarned: 0,
        refinePassesRemaining: 0,
      }),
    ],
    isTutorial: false,
    lateCount: 0,
    repPenaltyMultiplier: 1,
    roleCounts: { refine: 0, code: 0, review: 0, test: 0, conductor: 0 },
    kind: 'client' as const,
    duplicateProjectId: null,
    mrrContribution: 0,
    useConductor: false,
    slotIndex: 0,
  }

  return {
    state: { ...state, projects: [...state.projects, project] },
    projectId,
  }
}

export function deliverTutorialIfReady(state: GameState): GameState {
  const project = state.projects.find((p) => p.isTutorial)
  if (!project || !isReadyToDeliver(project)) return state
  return dispatchChain(state, [deliverProjectMsg(T0 + 200_000, project.id)])
}
