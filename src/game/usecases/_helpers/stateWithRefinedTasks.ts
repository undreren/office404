import { adjustRoleCountMsg, justMergePrMsg } from '../../messages'
import type { GameState } from '../../types'
import { advanceGameDays } from './advanceGameDays'
import { dispatchChain } from './dispatchChain'
import { initialPlaying } from './initialPlaying'
import { SEED, T0 } from './testConstants'

/** Tutorial project with at least one refined requirement and created tasks. */
export function stateWithRefinedTasks(seed: number = SEED): GameState {
  let state = initialPlaying(seed)
  state = advanceGameDays(state, 3, T0 + 1000)
  const project = state.projects[0]!
  if (project.tasks.length === 0) {
    state = advanceGameDays(state, 5, T0 + 5000)
  }
  return state
}

/** Tutorial project with a coder staffed on an open task. */
export function stateWithCoderStaffed(seed: number = SEED): GameState {
  let state = stateWithRefinedTasks(seed)
  const project = state.projects[0]!
  state = dispatchChain(state, [
    adjustRoleCountMsg(T0 + 6000, project.id, 'refine', -1),
    adjustRoleCountMsg(T0 + 7000, project.id, 'code', 1),
  ])
  return state
}

/** Tutorial project with a task at pr_ready status. */
export function stateWithPrReady(seed: number = SEED): GameState {
  let state = stateWithCoderStaffed(seed)
  const project = state.projects[0]!
  const task = project.tasks.find((t) => t.status !== 'merged' && !t.isReviewComment)
  if (!task) throw new Error('expected open task')

  for (let day = 1; day <= 30; day++) {
    state = advanceGameDays(state, 1, T0 + 10_000 + day * 1000)
    const updated = state.projects[0]!.tasks.find((t) => t.id === task.id)
    if (updated?.status === 'pr_ready') return state
  }
  throw new Error('task did not reach pr_ready')
}

/** Tutorial project with a merged task (via just-merge, skipping review). */
export function stateWithMergedTask(seed: number = SEED): GameState {
  let state = stateWithPrReady(seed)
  const project = state.projects[0]!
  const prTask = project.tasks.find((t) => t.status === 'pr_ready')
  if (!prTask) throw new Error('expected pr_ready task')

  state = dispatchChain(state, [justMergePrMsg(T0 + 50_000, prTask.id)])
  return state
}
