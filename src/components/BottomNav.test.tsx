import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAVE_KEY } from '../game/constants'
import { createInitialState } from '../game/simulation/gameLogic'
import { partializeSave } from '../runtime/persist'
import { TabNavProvider } from '../context/TabNavContext'
import { GameRuntimeProvider, useGameRuntime } from '../runtime/GameRuntime'
import { BottomNav } from './BottomNav'

function Hydrated({ children }: { children: ReactNode }) {
  const { hydrated } = useGameRuntime()
  if (!hydrated) return null
  return children
}

vi.mock('../runtime/persist', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../runtime/persist')>()
  return {
    ...actual,
    savePersistedState: vi.fn(),
  }
})

describe('BottomNav product tab', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })
  it('shows Product tab when in_house hallucination is unlocked', async () => {
    const state = {
      ...createInitialState(1000, 42),
      meta: {
        ...createInitialState(1000, 42).meta,
        hallucinationLevels: { in_house: 1 },
      },
      tutorialDone: true,
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(partializeSave(state)))

    render(
      <GameRuntimeProvider>
        <Hydrated>
          <TabNavProvider>
            <BottomNav />
          </TabNavProvider>
        </Hydrated>
      </GameRuntimeProvider>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Product' })).toBeInTheDocument()
    })
  })

  it('hides Product tab before in_house is unlocked', async () => {
    const state = {
      ...createInitialState(1000, 42),
      tutorialDone: true,
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(partializeSave(state)))

    render(
      <GameRuntimeProvider>
        <Hydrated>
          <TabNavProvider>
            <BottomNav />
          </TabNavProvider>
        </Hydrated>
      </GameRuntimeProvider>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Projects' })).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'Product' })).not.toBeInTheDocument()
  })
})
