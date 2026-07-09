import { useGameStore } from '../game/store'
import { NewGameButton } from './NewGameButton'

export function PlayerActionsPanel() {
  const playerAction = useGameStore((s) => s.playerAction)
  const agents = useGameStore((s) => s.agents)
  const projects = useGameStore((s) => s.projects)
  const startVibe = useGameStore((s) => s.startVibe)
  const mergePr = useGameStore((s) => s.mergePr)
  const justMergePr = useGameStore((s) => s.justMergePr)

  const prReadyTasks = projects.flatMap((p) =>
    p.tasks.filter((t) => t.status === 'pr_ready').map((t) => ({ ...t, project: p })),
  )

  const isForcedVibe = playerAction?.forced === true
  const isVibing = playerAction?.type === 'vibe'

  function reviewingProject(projectId: string) {
    return agents.find((a) => a.job === 'review' && a.projectId === projectId) ?? null
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
            const reviewer = reviewingProject(project.id)

            return (
              <div key={id} className="pr-item">
                <span>
                  {project.clientName}: {title}
                  {revealedQualityHit !== null && (
                    <em> · review est. -{revealedQualityHit.toFixed(1)}</em>
                  )}
                  {revealedQualityHit === null && !reviewer && (
                    <em> · assign a Review agent on the project</em>
                  )}
                  {reviewer && revealedQualityHit === null && (
                    <em> · {reviewer.name} reviewing PRs</em>
                  )}
                </span>
                <div className="action-row">
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
