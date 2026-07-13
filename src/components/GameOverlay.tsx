import { acceptSingularityMsg } from '../game/messages'
import { useGameDispatchAt, useGameState } from '../runtime/GameRuntime'

export function GameOverlay() {
  const { phase } = useGameState()
  const dispatchAt = useGameDispatchAt()

  if (phase !== 'singularity') return null

  return (
    <div className="game-overlay" role="dialog" aria-label="Singularity achieved">
      <div className="game-overlay__card">
        <h2>Singularity</h2>
        <p aria-label="Dyson sphere online. Customer hallucinations maxed. Reality is now a backlog item.">
          Dyson sphere online. Customer hallucinations maxed. Reality is now a backlog item.
        </p>
        <button
          type="button"
          className="btn btn--sprint"
          aria-label="Accept singularity and start a new cycle"
          onClick={() => dispatchAt(acceptSingularityMsg)}
        >
          Accept Singularity
        </button>
      </div>
    </div>
  )
}
