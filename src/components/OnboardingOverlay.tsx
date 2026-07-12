import { useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  STORY_INTRO_COPY,
  TAB_INTRO_COPY,
  TUTORIAL_STEP_COPY,
  TUTORIAL_STEP_COUNT,
} from '../game/onboarding'
import {
  acknowledgeStoryIntroMsg,
  acknowledgeTabIntroMsg,
  acknowledgeTutorialStepMsg,
} from '../game/messages'
import { useOnboardingModal } from '../hooks/useOnboardingModal'
import { useGameDispatchAt, useGamePaused } from '../runtime/GameRuntime'

export function OnboardingOverlay() {
  const modal = useOnboardingModal()
  const dispatchAt = useGameDispatchAt()
  const { setPaused } = useGamePaused()

  useLayoutEffect(() => {
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

  return createPortal(
    <div
      className="onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      data-testid="onboarding-dialog"
    >
      <div className="onboarding-overlay__card">
        {activeModal.kind === 'tutorial' && (
          <p className="onboarding-overlay__step">
            Tutorial {activeModal.step + 1} / {TUTORIAL_STEP_COUNT}
          </p>
        )}
        <h2 id="onboarding-title">{copy.title}</h2>
        <p className={activeModal.kind === 'story' ? 'onboarding-overlay__story' : undefined}>{copy.body}</p>
        <button
          type="button"
          className="btn btn--sprint"
          data-testid="onboarding-dismiss"
          onClick={dismiss}
        >
          Got it
        </button>
      </div>
    </div>,
    document.body,
  )
}
