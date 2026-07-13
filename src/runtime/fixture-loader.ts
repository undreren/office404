import { TUTORIAL_STEP_COUNT } from '../game/onboarding'
import type { GameState, MainTabId } from '../game/types'
import { injectPersistedState } from './persist'

const ALL_TABS: MainTabId[] = ['feed', 'shop', 'agents', 'projects', 'leads', 'hallucinations']

/** Load a named fixture from public/fixtures/{name}.json */
export async function loadNamedFixture(name: string): Promise<GameState | null> {
  try {
    const base = import.meta.env.BASE_URL ?? '/'
    const res = await fetch(`${base}fixtures/${name}.json`)
    if (!res.ok) return null
    return (await res.json()) as GameState
  } catch {
    return null
  }
}

export function applySkipOnboarding(state: GameState): GameState {
  return {
    ...state,
    seenStoryIntro: true,
    seenTabIntros: ALL_TABS,
    acknowledgedTutorialStep: TUTORIAL_STEP_COUNT - 1,
  }
}

/** Dev / Playwright: ?fixture=name loads fixture into localStorage before boot. */
export async function applyFixtureFromUrl(): Promise<GameState | null> {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const fixture = params.get('fixture')
  if (!fixture) return null
  const loaded = await loadNamedFixture(fixture)
  if (!loaded) return null
  const state = params.get('skipOnboarding') === '1' ? applySkipOnboarding(loaded) : loaded
  injectPersistedState(state)
  return state
}
