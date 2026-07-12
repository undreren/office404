import { useEffect, useMemo } from 'react'
import { useTabNav } from '../context/TabNavContext'
import {
  getTutorialStep,
  STORY_INTRO_COPY,
  TAB_INTRO_COPY,
  TUTORIAL_STEP_COPY,
  TUTORIAL_STEP_COUNT,
  type TutorialStep,
} from '../game/onboarding'
import type { MainTabId } from '../game/types'
import {
  acknowledgeStoryIntroMsg,
  acknowledgeTabIntroMsg,
  acknowledgeTutorialStepMsg,
} from '../game/messages'
import { useGameDispatchAt, useGamePaused, useGameState } from '../runtime/GameRuntime'

type OnboardingModal =
  | { kind: 'story' }
  | { kind: 'tab'; tab: MainTabId }
  | { kind: 'tutorial'; step: TutorialStep }

function resolveOnboardingModal(
  activeTab: MainTabId,
  seenStoryIntro: boolean,
  seenTabIntros: MainTabId[],
  tutorialDone: boolean,
  acknowledgedTutorialStep: number,
  tutorialStep: TutorialStep | null,
): OnboardingModal | null {
  if (activeTab === 'projects' && !seenStoryIntro) {
    return { kind: 'story' }
  }
  if (!seenTabIntros.includes(activeTab)) {
    return { kind: 'tab', tab: activeTab }
  }
  if (activeTab === 'projects' && !tutorialDone && tutorialStep !== null) {
    if (tutorialStep > acknowledgedTutorialStep) {
      return { kind: 'tutorial', step: tutorialStep }
    }
  }
  return null
}

export function OnboardingOverlay() {
  const state = useGameState()
  const { activeTab } = useTabNav()
  const dispatchAt = useGameDispatchAt()
  const { setPaused } = useGamePaused()

  const tutorialStep = useMemo(() => getTutorialStep(state), [state])

  const modal = useMemo(
    () =>
      resolveOnboardingModal(
        activeTab,
        state.seenStoryIntro,
        state.seenTabIntros,
        state.tutorialDone,
        state.acknowledgedTutorialStep,
        tutorialStep,
      ),
    [
      activeTab,
      state.seenStoryIntro,
      state.seenTabIntros,
      state.tutorialDone,
      state.acknowledgedTutorialStep,
      tutorialStep,
    ],
  )

  useEffect(() => {
    setPaused(modal !== null)
  }, [modal, setPaused])

  if (!modal) return null

  const activeModal = modal
  const copy =
    activeModal.kind === 'story'
      ? STORY_INTRO_COPY
      : activeModal.kind === 'tab'
        ? TAB_INTRO_COPY[activeModal.tab]
        : TUTORIAL_STEP_COPY[activeModal.step]

  function dismiss() {
    if (activeModal.kind === 'story') {
      dispatchAt((at) => acknowledgeStoryIntroMsg(at))
      return
    }
    if (activeModal.kind === 'tab') {
      dispatchAt((at) => acknowledgeTabIntroMsg(at, activeModal.tab))
      return
    }
    dispatchAt((at) => acknowledgeTutorialStepMsg(at, activeModal.step))
  }

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-overlay__card">
        {activeModal.kind === 'tutorial' && (
          <p className="onboarding-overlay__step">
            Tutorial {activeModal.step + 1} / {TUTORIAL_STEP_COUNT}
          </p>
        )}
        <h2 id="onboarding-title">{copy.title}</h2>
        <p className={activeModal.kind === 'story' ? 'onboarding-overlay__story' : undefined}>{copy.body}</p>
        <button type="button" className="btn btn--sprint" onClick={dismiss}>
          Got it
        </button>
      </div>
    </div>
  )
}
