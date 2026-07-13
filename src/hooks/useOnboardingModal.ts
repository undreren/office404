import { useMemo } from 'react'
import { useTabNav } from '../context/TabNavContext'
import { getTutorialStep, type TutorialStep } from '../game/onboarding'
import type { MainTabId } from '../game/types'
import { useGameState } from '../runtime/GameRuntime'

export type OnboardingModal =
  | { kind: 'story' }
  | { kind: 'tab'; tab: MainTabId }
  | { kind: 'tutorial'; step: TutorialStep }
  | { kind: 'compaction' }

function resolveOnboardingModal(
  activeTab: MainTabId,
  seenStoryIntro: boolean,
  seenTabIntros: MainTabId[],
  seenCompactionIntro: boolean,
  compactionsSurvived: number,
  tutorialDone: boolean,
  acknowledgedTutorialStep: number,
  tutorialStep: TutorialStep | null,
): OnboardingModal | null {
  if (activeTab === 'projects' && !seenStoryIntro) {
    return { kind: 'story' }
  }
  if (!seenCompactionIntro && compactionsSurvived > 0) {
    return { kind: 'compaction' }
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

export function useOnboardingModal(): OnboardingModal | null {
  const state = useGameState()
  const { activeTab } = useTabNav()
  const tutorialStep = useMemo(() => getTutorialStep(state), [state])

  return useMemo(
    () =>
      resolveOnboardingModal(
        activeTab,
        state.seenStoryIntro,
        state.seenTabIntros,
        state.seenCompactionIntro,
        state.stats.compactionsSurvived,
        state.tutorialDone,
        state.acknowledgedTutorialStep,
        tutorialStep,
      ),
    [
      activeTab,
      state.seenStoryIntro,
      state.seenTabIntros,
      state.seenCompactionIntro,
      state.stats.compactionsSurvived,
      state.tutorialDone,
      state.acknowledgedTutorialStep,
      tutorialStep,
    ],
  )
}
