import { getModel } from '../game/models'
import { useGameStore } from '../game/store'
import { NewGameButton } from './NewGameButton'

export function PlayerActionsPanel() {
  const playerAction = useGameStore((s) => s.playerAction)
  const agents = useGameStore((s) => s.agents)
  const projects = useGameStore((s) => s.projects)
  const startVibe = useGameStore((s) => s.startVibe)
  const mergePr = useGameStore((s) => s.mergePr)
  const justMergePr = useGameStore((s) => s.justMergePr)
  const assignAgentToReview = useGameStore((s) => s.assignAgentToReview)

  const prReadyTasks = projects.flatMap((p) =>
    p.tasks.filter((t) => t.status === 'pr_ready').map((t) => ({ ...t, project: p })),
  )

  const isForcedVibe = playerAction?.forced === true
  const isVibing = playerAction?.type === 'vibe'

  const idleAgents = agents.filter((a) => !a.job && a.status !== 'compacted')

  function reviewingAgent(taskId: string) {
    return agents.find((a) => a.job === 'review' && a.taskId === taskId) ?? null
  }

  return (
    <section className="panel actions-panel">
      <div className="panel__header">
        <h2>Your Move</h2>
        <NewGameButton />
      </div>
      <p className="hint">You can&apos;t code. You can&apos;t review. You can vibe. Agents do the scary stuff.</p>

      {playerAction && (
        <div className="action-status">
          <strong>
            {isVibing && (isForcedVibe ? 'Forced smoke break…' : 'Vibing…')}
          </strong>
        </div>
      )}

      <div className="action-row">
        <button
          type="button"
          className={`btn btn--zone ${isVibing ? 'btn--active' : ''}`}
          onClick={startVibe}
          disabled={isForcedVibe}
        >
          {isVibing && !isForcedVibe ? 'Stop vibe' : 'Vibe'}
        </button>
      </div>

      {prReadyTasks.length > 0 && (
        <div className="pr-queue">
          <h3>PRs Waiting ({prReadyTasks.length})</h3>
          {prReadyTasks.map(({ id, title, project, revealedQualityHit }) => {
            const reviewer = reviewingAgent(id)
            const reviewPct = reviewer && reviewer.jobDuration > 0
              ? Math.min(100, (reviewer.jobProgress / reviewer.jobDuration) * 100)
              : 0

            return (
              <div key={id} className="pr-item">
                <span>
                  {project.clientName}: {title}
                  {revealedQualityHit !== null && (
                    <em> · review est. -{revealedQualityHit.toFixed(1)}</em>
                  )}
                  {revealedQualityHit === null && !reviewer && (
                    <em> · assign an agent to review</em>
                  )}
                  {reviewer && revealedQualityHit === null && (
                    <em> · {reviewer.name} reviewing ({Math.round(reviewPct)}%)</em>
                  )}
                </span>
                <div className="action-row">
                  {revealedQualityHit === null && !reviewer && idleAgents.slice(0, 3).map((a) => {
                    const model = getModel(a.modelId)
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className="btn btn--small"
                        onClick={() => assignAgentToReview(a.id, id)}
                        disabled={isForcedVibe}
                      >
                        Review → {a.name} ({model?.parameters ?? '?'}B)
                      </button>
                    )
                  })}
                  {revealedQualityHit !== null && (
                    <button type="button" className="btn btn--small btn--sprint" onClick={() => mergePr(id)} disabled={isForcedVibe}>
                      Merge
                    </button>
                  )}
                  <button type="button" className="btn btn--small btn--danger" onClick={() => justMergePr(id)} disabled={isForcedVibe}>
                    Just Merge
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
