import { describe, expect, it } from 'vitest'
import { getTutorialStep } from '../onboarding'
import { initialPlaying } from './_helpers/initialPlaying'
import type { GameState } from '../types'

describe('getTutorialStep', () => {
  it('returns 0 while requirements are still refining', () => {
    expect(getTutorialStep(initialPlaying())).toBe(0)
  })

  it('returns 1 once tasks exist but no coder is staffed', () => {
    const base = initialPlaying()
    const project = base.projects[0]!
    const req = project.requirements[0]!
    const state: GameState = {
      ...base,
      projects: [
        {
          ...project,
          requirements: [{ ...req, status: 'refined' }],
          tasks: [
            {
              id: 'task-1',
              projectId: project.id,
              requirementId: req.id,
              title: 'Ship login',
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
            },
          ],
        },
      ],
    }

    expect(getTutorialStep(state)).toBe(1)
  })
})
