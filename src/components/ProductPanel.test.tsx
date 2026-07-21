import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAVE_KEY } from '../game/constants'
import { createInitialState } from '../game/simulation/gameLogic'
import { partializeSave } from '../runtime/persist'
import { TabNavProvider } from '../context/TabNavContext'
import { GameRuntimeProvider, useGameRuntime } from '../runtime/GameRuntime'
import { ProductPanel } from './ProductPanel'

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

describe('ProductPanel slot carousel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('renders only the focused product slot and navigates with dots', async () => {
    const user = userEvent.setup()
    const state = {
      ...createInitialState(1000, 42),
      tutorialDone: true,
      meta: {
        ...createInitialState(1000, 42).meta,
        hallucinationLevels: { in_house: 2 },
      },
      productBacklog: [
        { id: 'prod-1', title: 'Auth module', storyPoints: 1, status: 'queued' as const },
        { id: 'prod-2', title: 'Billing module', storyPoints: 2, status: 'queued' as const },
      ],
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(partializeSave(state)))

    render(
      <GameRuntimeProvider>
        <Hydrated>
          <TabNavProvider>
            <ProductPanel />
          </TabNavProvider>
        </Hydrated>
      </GameRuntimeProvider>,
    )

    await waitFor(() => {
      expect(screen.getByRole('list', { name: 'In-house product slots' })).toBeInTheDocument()
    })

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Start Auth module' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start Billing module' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Billing module' }))

    expect(screen.getByRole('button', { name: 'Start Billing module' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start Auth module' })).not.toBeInTheDocument()
  })
})
