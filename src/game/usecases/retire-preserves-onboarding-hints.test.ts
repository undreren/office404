import { describe, expect, it } from 'vitest'
import {
  acknowledgeCompactionIntroMsg,
  acknowledgeStoryIntroMsg,
  acknowledgeTabIntroMsg,
  acknowledgeTutorialStepMsg,
  retireMsg,
} from '../messages'
import { LADDER_BASE_CASH } from '../prestige'
import { dispatchChain } from './_helpers/dispatchChain'
import { initialPlaying } from './_helpers/initialPlaying'
import { stateWithCash } from './_helpers/stateWithCash'
import { T0 } from './_helpers/testConstants'

describe('retire-preserves-onboarding-hints', () => {
  it('keeps dismissed story, tab, tutorial, and compaction intros', () => {
    const before = dispatchChain(stateWithCash(initialPlaying(), LADDER_BASE_CASH), [
      acknowledgeStoryIntroMsg(T0 + 1),
      acknowledgeTabIntroMsg(T0 + 2, 'projects'),
      acknowledgeTabIntroMsg(T0 + 3, 'shop'),
      acknowledgeTutorialStepMsg(T0 + 4, 3),
      acknowledgeCompactionIntroMsg(T0 + 5),
    ])

    const after = dispatchChain(before, [retireMsg(T0 + 1000)])

    expect(after.seenStoryIntro).toBe(true)
    expect(after.seenTabIntros).toEqual(['projects', 'shop'])
    expect(after.acknowledgedTutorialStep).toBe(3)
    expect(after.seenCompactionIntro).toBe(true)
  })
})
