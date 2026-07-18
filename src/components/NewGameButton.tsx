import { useState } from 'react'
import { formatCash } from '../game/cash'
import { canRetire, personalRetirementThreshold } from '../game/prestige'
import { resetGameMsg, retireMsg } from '../game/messages'
import { useGameDispatchAt, useGameState } from '../runtime/GameRuntime'

export function NewGameButton() {
  const { cash, meta } = useGameState()
  const dispatchAt = useGameDispatchAt()
  const [confirming, setConfirming] = useState(false)

  const eligible = canRetire(cash, meta.highestRungEver)
  const threshold = personalRetirementThreshold(meta.highestRungEver)

  function handleClick() {
    if (eligible) {
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
        className={`btn resource-bar__quit ${eligible ? 'resource-bar__quit--retire' : 'resource-bar__quit--danger'}`}
        aria-label={
          eligible
            ? `Retire at ${formatCash(threshold)} for hallucination points`
            : 'Start a new game'
        }
        onClick={handleClick}
      >
        {eligible ? 'Retire' : 'just give up'}
      </button>

      {confirming && (
        <div className="game-overlay" role="dialog" aria-label="Confirm new game">
          <div className="game-overlay__card">
            <h2>Give Up?</h2>
            <p aria-label="Your agency, agents, and petty cash go back to Day 0. This cannot be undone.">
              Your agency, agents, and petty cash go back to Day 0. Prestige hallucinations are kept. This cannot be
              undone.
            </p>
            <div className="game-overlay__actions">
              <button
                type="button"
                className="btn btn--danger"
                aria-label="Confirm start new game"
                onClick={handleConfirm}
              >
                just give up
              </button>
              <button
                type="button"
                className="btn"
                aria-label="Keep playing"
                onClick={() => setConfirming(false)}
              >
                Keep Playing
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
