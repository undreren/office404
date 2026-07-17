import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { SAVE_KEY } from '../game/constants'
import { createInitialState } from '../game/simulation/gameLogic'
import { partializeSave } from '../runtime/persist'
import { GameRuntimeProvider, useGameRuntime } from '../runtime/GameRuntime'
import { ResourceBar } from './ResourceBar'

function Hydrated({ children }: { children: ReactNode }) {
  const { hydrated } = useGameRuntime()
  if (!hydrated) return null
  return children
}

describe('ResourceBar', () => {
  it('shows cash and reputation from game state', async () => {
    const state = createInitialState(1000, 42)
    localStorage.setItem(SAVE_KEY, JSON.stringify(partializeSave(state)))

    render(
      <GameRuntimeProvider>
        <Hydrated>
          <ResourceBar />
        </Hydrated>
      </GameRuntimeProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('OFFICE 404')).toBeInTheDocument()
      expect(screen.getByText(/Day 0 - 08:00 AM/)).toBeInTheDocument()
    })

    const cashResource = screen.getByText('Cash').closest('.resource')
    const repResource = screen.getByText('Rep').closest('.resource')
    expect(cashResource).toHaveTextContent('$0')
    expect(repResource).toHaveTextContent('0')
  })
})
