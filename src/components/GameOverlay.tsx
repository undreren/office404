import { useGameStore } from '../game/store'

export function GameOverlay() {
  const phase = useGameStore((s) => s.phase)
  const resetGame = useGameStore((s) => s.resetGame)

  if (phase === 'playing') return null

  return (
    <div className="game-overlay">
      <div className="game-overlay__card">
        {phase === 'won' && (
          <>
            <h2>You Retired!</h2>
            <p>$10M net worth achieved. You sold the server farm and moved somewhere with no Slack.</p>
          </>
        )}
        {phase === 'lost' && (
          <>
            <h2>Cardboard Box Acquired</h2>
            <p>No reputation. No clients. The agents would keep working, but nobody's paying.</p>
          </>
        )}
        <button type="button" className="btn btn--sprint" onClick={resetGame}>
          Start Over
        </button>
      </div>
    </div>
  )
}
