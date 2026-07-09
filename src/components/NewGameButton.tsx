import { useState } from 'react'
import { useGameStore } from '../game/store'

export function NewGameButton() {
  const resetGame = useGameStore((s) => s.resetGame)
  const [confirming, setConfirming] = useState(false)

  function handleConfirm() {
    resetGame()
    setConfirming(false)
  }

  return (
    <>
      <button
        type="button"
        className="btn btn--small btn--danger resource-bar__new-game"
        onClick={() => setConfirming(true)}
      >
        New Game
      </button>

      {confirming && (
        <div className="game-overlay">
          <div className="game-overlay__card">
            <h2>Start Fresh?</h2>
            <p>Your agency, agents, and petty cash go back to Day 0. This cannot be undone.</p>
            <div className="game-overlay__actions">
              <button type="button" className="btn btn--sprint" onClick={handleConfirm}>
                New Game
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>
                Keep Playing
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
