import { refineRequirementToTasks } from '../game/projects'
import { createInitialState } from '../game/simulation/gameLogic'
import { ctxFrom } from '../game/simulation/simCtx'
import type { GameState } from '../game/types'
import { SEED, T0 } from '../game/usecases/_helpers/testConstants'

/** Tutorial on Projects with refined tasks and an idle agent — ready to staff code. */
export function tutorialReadyForCodeFixture(seed: number = SEED): GameState {
  const state = createInitialState(T0, seed)
  const ctx = ctxFrom(state)
  const project = state.projects[0]!
  const tasks = project.requirements.flatMap((req) =>
    refineRequirementToTasks(ctx, req, { forceSingle: true }),
  )

  return {
    ...state,
    gameDay: 2,
    agents: state.agents.map((agent) => ({
      ...agent,
      job: null,
      taskId: null,
      projectId: null,
      jobProgress: 0,
      jobDuration: 0,
      status: 'idle' as const,
      contextUsed: 0,
      compactingRemainingSec: 0,
    })),
    projects: [
      {
        ...project,
        requirements: project.requirements.map((req) => ({ ...req, status: 'refined' as const })),
        tasks,
        roleCounts: { ...project.roleCounts, refine: 0, code: 0, review: 0, test: 0 },
      },
    ],
    snapshotAt: T0,
  }
}
