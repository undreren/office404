import { resetGameMsg } from '../game/messages'
import { useGameDispatchAt, useGameState } from '../runtime/GameRuntime'

export function GameOverlay() {
  const { phase } = useGameState()
  const dispatchAt = useGameDispatchAt()

  if (phase === 'playing') return null

  return (
    <div className="game-overlay" role="dialog" aria-label={phase === 'won' ? 'You retired' : 'Game over'}>
      <div className="game-overlay__card">
        {phase === 'won' && (
          <>
            <h2>You Retired!</h2>
            <p aria-label="$10M net worth achieved. You sold the server farm and moved somewhere with no Slack.">
              $10M net worth achieved. You sold the server farm and moved somewhere with no Slack.
            </p>
          </>
        )}
        {phase === 'lost' && (
          <>
            <h2>Cardboard Box Acquired</h2>
            <p aria-label="No reputation. No clients. The agents would keep working, but nobody's paying.">
              No reputation. No clients. The agents would keep working, but nobody&apos;s paying.
            </p>
          </>
        )}
        <button
          type="button"
          className="btn btn--sprint"
          aria-label="Start over"
          onClick={() => dispatchAt(resetGameMsg)}
        >
          Start Over
        </button>
      </div>
    </div>
  )
}
