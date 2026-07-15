import { describe, expect, it } from 'vitest'
import { timeElapsed } from '../messages'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { Agent, GameState, Project, Task } from '../types'

function conductorAgent(id: string, projectId: string): Agent {
  return {
    id,
    name: id,
    personality: 'testy',
    job: 'conductor',
    projectId,
    taskId: null,
    status: 'conducting',
    contextUsed: 0,
    compactingRemainingSec: 0,
    jobProgress: 0,
    jobDuration: 0,
    uptime: 0,
    isAutomation: false,
    conductorMoveRemaining: 0,
  }
}

function codeAgent(
  id: string,
  projectId: string,
  taskId: string | null,
  status: Agent['status'],
): Agent {
  return {
    id,
    name: id,
    personality: 'testy',
    job: 'code',
    projectId,
    taskId,
    status,
    contextUsed: 0,
    compactingRemainingSec: 0,
    jobProgress: 0,
    jobDuration: 0,
    uptime: 0,
    isAutomation: false,
  }
}

function conductorProject(id: string, name: string): Project {
  const base = initialPlaying().projects[0]!
  return {
    ...base,
    id,
    clientName: name,
    isTutorial: false,
    kind: 'client',
    useConductor: true,
    roleCounts: { refine: 0, code: 2, review: 0, test: 0, conductor: 1 },
    requirements: base.requirements.map((r) => ({ ...r, status: 'open' as const, refineJobProgress: 0, refineJobDuration: 0 })),
    tasks: [],
  }
}

function sharedCodingTask(projectId: string, requirementId: string): Task {
  return {
    id: 'task-shared',
    projectId,
    requirementId,
    title: 'Shared task',
    storyPointsRequired: 20,
    storyPointsEarned: 2,
    complexity: 2,
    refined: true,
    status: 'in_progress',
    assignedAgentId: 'coder-primary',
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
  }
}

describe('conductor-steals-best-of-n-assist', () => {
  it('does not pull a busy Best-of-N assist from another project when no idle agents exist', () => {
    const base = initialPlaying()
    const req = base.projects[0]!.requirements[0]!
    const donorProject = conductorProject('proj-donor', 'Donor Co')
    const needyProject = conductorProject('proj-needy', 'Needy Co')
    const task = sharedCodingTask(donorProject.id, req.id)

    const before: GameState = {
      ...base,
      vibingCourses: ['conductor'],
      vibingCourseTiers: { ...base.vibingCourseTiers, best_of_n: 1 },
      projects: [
        {
          ...donorProject,
          requirements: donorProject.requirements.map((r) => ({ ...r, status: 'refined' as const })),
          tasks: [task],
        },
        needyProject,
      ],
      agents: [
        conductorAgent('conductor-donor', donorProject.id),
        codeAgent('coder-primary', donorProject.id, task.id, 'working'),
        codeAgent('coder-assist', donorProject.id, task.id, 'working'),
        conductorAgent('conductor-needy', needyProject.id),
      ],
    }

    const after = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    expect(after.agents.find((a) => a.id === 'coder-assist')?.projectId).toBe(donorProject.id)
    expect(after.agents.find((a) => a.id === 'coder-assist')?.job).toBe('code')
    expect(after.projects[0]!.tasks[0]!.storyPointsEarned).toBeGreaterThanOrEqual(2)
  })

  it('does not reassign a same-project busy Best-of-N assist when conductor needs coverage', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task = sharedCodingTask(project.id, req.id)

    const before: GameState = {
      ...base,
      vibingCourses: ['conductor'],
      vibingCourseTiers: { ...base.vibingCourseTiers, best_of_n: 1 },
      projects: [
        {
          ...project,
          useConductor: true,
          tasks: [task],
          requirements: project.requirements.map((r) => ({ ...r, status: 'open' as const })),
          roleCounts: { refine: 0, code: 2, review: 0, test: 0, conductor: 1 },
        },
      ],
      agents: [
        conductorAgent('conductor-1', project.id),
        codeAgent('coder-primary', project.id, task.id, 'working'),
        codeAgent('coder-assist', project.id, task.id, 'working'),
      ],
    }

    const after = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    expect(after.agents.find((a) => a.id === 'coder-assist')?.job).toBe('code')
    expect(after.agents.find((a) => a.id === 'coder-assist')?.taskId).toBe(task.id)
  })

  it('pulls an idle Best-of-N assist from another project for unallocated work', () => {
    const base = initialPlaying()
    const req = base.projects[0]!.requirements[0]!
    const donorProject = conductorProject('proj-donor', 'Donor Co')
    const needyProject = conductorProject('proj-needy', 'Needy Co')
    const task = sharedCodingTask(donorProject.id, req.id)

    const before: GameState = {
      ...base,
      vibingCourses: ['conductor'],
      vibingCourseTiers: { ...base.vibingCourseTiers, best_of_n: 1 },
      projects: [
        {
          ...donorProject,
          requirements: donorProject.requirements.map((r) => ({ ...r, status: 'refined' as const })),
          tasks: [task],
        },
        needyProject,
      ],
      agents: [
        conductorAgent('conductor-donor', donorProject.id),
        codeAgent('coder-primary', donorProject.id, task.id, 'working'),
        codeAgent('coder-assist', donorProject.id, task.id, 'idle'),
        conductorAgent('conductor-needy', needyProject.id),
      ],
    }

    const after = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    expect(after.agents.find((a) => a.id === 'coder-assist')?.projectId).toBe(needyProject.id)
    expect(after.agents.find((a) => a.id === 'coder-assist')?.job).toBe('refine')
  })

  it('reassigns an idle same-project Best-of-N assist to another role for unallocated work', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const task = sharedCodingTask(project.id, req.id)

    const before: GameState = {
      ...base,
      vibingCourses: ['conductor'],
      vibingCourseTiers: { ...base.vibingCourseTiers, best_of_n: 1 },
      projects: [
        {
          ...project,
          useConductor: true,
          tasks: [task],
          requirements: project.requirements.map((r) => ({ ...r, status: 'open' as const })),
          roleCounts: { refine: 0, code: 2, review: 0, test: 0, conductor: 1 },
        },
      ],
      agents: [
        conductorAgent('conductor-1', project.id),
        codeAgent('coder-primary', project.id, task.id, 'working'),
        codeAgent('coder-assist', project.id, task.id, 'idle'),
      ],
    }

    const after = dispatchChain(before, [timeElapsed(T0 + 1000, 1)])

    const refineWorker = after.agents.find((a) => a.projectId === project.id && a.job === 'refine')
    expect(refineWorker?.id).toBe('coder-assist')
  })
})
