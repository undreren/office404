import { useState } from 'react'
import { WIN_CASH } from '../game/constants'
import { resetGameMsg, retireMsg } from '../game/messages'
import { useGameDispatchAt, useGameState } from '../runtime/GameRuntime'

export function NewGameButton() {
  const { cash } = useGameState()
  const dispatchAt = useGameDispatchAt()
  const [confirming, setConfirming] = useState(false)

  const canRetire = cash >= WIN_CASH

  function handleClick() {
    if (canRetire) {
      dispatchAt(retireMsg)
      return
    }
    setConfirming(true)
  }

  function handleConfirm() {
    dispatchAt(resetGameMsg)
    setConfirming(false)
  }

  return (
    <>
      <button
        type="button"
        className={`btn resource-bar__quit ${canRetire ? 'resource-bar__quit--retire' : 'resource-bar__quit--danger'}`}
        onClick={handleClick}
      >
        {canRetire ? 'Retire' : 'just give up'}
      </button>

      {confirming && (
        <div className="game-overlay">
          <div className="game-overlay__card">
            <h2>Give Up?</h2>
            <p>Your agency, agents, and petty cash go back to Day 0. This cannot be undone.</p>
            <div className="game-overlay__actions">
              <button type="button" className="btn btn--danger" onClick={handleConfirm}>
                just give up
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
