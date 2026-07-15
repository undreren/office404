import { describe, expect, it } from 'vitest'
import { adjustRoleCountMsg, timeElapsed } from '../messages'
import { taskTokensRequired } from '../mechanics'
import { requirementRefineProgressPct } from '../projects'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { T0 } from './_helpers/testConstants'
import type { GameState } from '../types'

describe('unstaff-refine-preserves-progress', () => {
  it('keeps partial refine progress on the requirement when all refine agents are removed', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const requirement = project.requirements[0]!
    const before: GameState = {
      ...base,
      projects: [
        {
          ...project,
          roleCounts: { refine: 1, code: 0, review: 0, test: 0, conductor: 0 },
        },
      ],
      agents: base.agents.map((a) => ({
        ...a,
        job: 'refine' as const,
        projectId: project.id,
        status: 'refining' as const,
        taskId: requirement.id,
        jobProgress: 1.2,
        jobDuration: taskTokensRequired(requirement.storyPoints, 'refine'),
        contextUsed: 0,
        compactingRemainingSec: 0,
      })),
    }

    const unstaffed = dispatchChain(before, [adjustRoleCountMsg(T0 + 1000, project.id, 'refine', -1)])
    const req = unstaffed.projects[0]!.requirements[0]!

    expect(req.refineJobProgress).toBe(1.2)
    expect(req.refineJobDuration).toBeUndefined()
    const required = taskTokensRequired(requirement.storyPoints, 'refine')
    expect(requirementRefineProgressPct(unstaffed.projects[0]!, req, unstaffed.agents)).toBeCloseTo(
      (1.2 / required) * 100,
      0,
    )

    const restaffed = dispatchChain(unstaffed, [adjustRoleCountMsg(T0 + 2000, project.id, 'refine', 1)])
    const progressed = dispatchChain(restaffed, [timeElapsed(T0 + 3000, 0.2)])

    expect(progressed.projects[0]!.requirements[0]!.status).toBe('open')
    expect(
      requirementRefineProgressPct(
        progressed.projects[0]!,
        progressed.projects[0]!.requirements[0]!,
        progressed.agents,
      ),
    ).toBeGreaterThan((1.2 / required) * 100)
  })
})
