import { useGameStore } from '../game/store'

export function PlayerActionsPanel() {
  const playerAction = useGameStore((s) => s.playerAction)
  const selectedTaskId = useGameStore((s) => s.selectedTaskId)
  const sanity = useGameStore((s) => s.sanity)
  const reviewRevealedHit = useGameStore((s) => s.reviewRevealedHit)
  const projects = useGameStore((s) => s.projects)
  const startSprint = useGameStore((s) => s.startSprint)
  const startVibe = useGameStore((s) => s.startVibe)
  const startRefine = useGameStore((s) => s.startRefine)
  const startRefactor = useGameStore((s) => s.startRefactor)
  const startReview = useGameStore((s) => s.startReview)
  const justMerge = useGameStore((s) => s.justMerge)
  const completeMerge = useGameStore((s) => s.completeMerge)
  const cancelPlayerAction = useGameStore((s) => s.cancelPlayerAction)

  const selectedTask = selectedTaskId
    ? projects.flatMap((p) => p.tasks).find((t) => t.id === selectedTaskId)
    : null

  const prReadyTasks = projects.flatMap((p) =>
    p.tasks.filter((t) => t.status === 'pr_ready').map((t) => ({ ...t, project: p })),
  )

  const busy = playerAction !== null
  const isForcedVibe = playerAction?.forced === true

  return (
    <section className="panel actions-panel">
      <h2>Your Move</h2>
      <p className="hint">One action at a time. Mom doesn&apos;t work here.</p>

      {playerAction && (
        <div className="action-status">
          <strong>
            {playerAction.type === 'sprint' && 'Sprinting…'}
            {playerAction.type === 'vibe' && (isForcedVibe ? 'Forced smoke break…' : 'Vibing…')}
            {playerAction.type === 'review' && `Reviewing… ${Math.ceil((playerAction.duration - playerAction.progress) * 60)}s`}
            {playerAction.type === 'refine' && `Refining… ${Math.ceil((playerAction.duration - playerAction.progress) * 60)}s`}
            {playerAction.type === 'refactor' && `Refactoring… ${Math.ceil((playerAction.duration - playerAction.progress) * 60)}s`}
          </strong>
          {!isForcedVibe && playerAction.type !== 'review' && (
            <button type="button" className="btn btn--small" onClick={cancelPlayerAction}>
              Stop
            </button>
          )}
        </div>
      )}

      {reviewRevealedHit !== null && selectedTask?.status === 'pr_ready' && (
        <div className="review-result">
          <p>Quality hit if merged: <strong>-{reviewRevealedHit.toFixed(1)}</strong></p>
          <div className="action-row">
            <button type="button" className="btn btn--sprint" onClick={() => completeMerge(selectedTask.id)}>
              Merge (reviewed)
            </button>
            <button type="button" className="btn" onClick={() => startRefactor(selectedTask.id)} disabled={busy}>
              Refactor first
            </button>
          </div>
        </div>
      )}

      <div className="action-row">
        <button
          type="button"
          className={`btn btn--sprint ${playerAction?.type === 'sprint' ? 'btn--active' : ''}`}
          onClick={startSprint}
          disabled={busy || !selectedTask || selectedTask.status === 'merged' || selectedTask.status === 'pr_ready' || sanity < 5}
        >
          Sprint
        </button>
        <button
          type="button"
          className={`btn btn--zone ${playerAction?.type === 'vibe' ? 'btn--active' : ''}`}
          onClick={startVibe}
          disabled={busy && !isForcedVibe}
        >
          Vibe
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => selectedTask && startRefine(selectedTask.id)}
          disabled={busy || !selectedTask || selectedTask.refined || selectedTask.complexity < 6}
        >
          Refine
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => selectedTask && startRefactor(selectedTask.id)}
          disabled={busy || !selectedTask}
        >
          Refactor
        </button>
      </div>

      {prReadyTasks.length > 0 && (
        <div className="pr-queue">
          <h3>PRs Waiting ({prReadyTasks.length})</h3>
          {prReadyTasks.map(({ id, title, project }) => (
            <div key={id} className="pr-item">
              <span>
                {project.clientName}: {title}
              </span>
              <div className="action-row">
                <button type="button" className="btn btn--small" onClick={() => startReview(id)} disabled={busy}>
                  Review
                </button>
                <button type="button" className="btn btn--small btn--danger" onClick={() => justMerge(id)} disabled={busy}>
                  Just Merge
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
