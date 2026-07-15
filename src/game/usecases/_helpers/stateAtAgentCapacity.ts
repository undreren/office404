import type { Agent, GameState } from '../../types'
import { initialPlaying } from './initialPlaying'

/** RAM-full roster: 10 GB base fits two 4B agents (4 GB each). */
export function stateAtAgentCapacity(seed?: number): GameState {
  const base = initialPlaying(seed)
  const starter = base.agents[0]!
  const project = base.projects[0]!
  const second: Agent = {
    ...starter,
    id: 'agt-cap-2',
    name: 'Cap Two',
    job: 'refine',
    projectId: project.id,
    taskId: null,
    status: 'refining',
    contextUsed: 0,
    compactingRemainingSec: 0,
    jobProgress: 0,
    jobDuration: 0,
  }
  const staffedStarter: Agent = {
    ...starter,
    job: 'code',
    projectId: project.id,
    status: 'working',
    taskId: null,
  }
  return {
    ...base,
    agents: [staffedStarter, second],
    projects: [
      {
        ...project,
        roleCounts: { refine: 1, code: 1, review: 0, test: 0, conductor: 0 },
      },
    ],
  }
}
