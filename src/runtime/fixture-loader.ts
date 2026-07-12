import type { GameState } from '../game/types'
import { injectPersistedState } from './persist'

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

/** Dev / Playwright: ?fixture=name loads fixture into localStorage before boot. */
export async function applyFixtureFromUrl(): Promise<GameState | null> {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const fixture = params.get('fixture')
  if (!fixture) return null
  const state = await loadNamedFixture(fixture)
  if (state) injectPersistedState(state)
  return state
}
