import { useGameStore } from '../game/store'
import { NewGameButton } from './NewGameButton'

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

  const selectedTask = selectedTaskId
    ? projects.flatMap((p) => p.tasks).find((t) => t.id === selectedTaskId)
    : null

  const selectedProject = selectedTask
    ? projects.find((p) => p.tasks.some((t) => t.id === selectedTask.id))
    : null

  const prReadyTasks = projects.flatMap((p) =>
    p.tasks.filter((t) => t.status === 'pr_ready').map((t) => ({ ...t, project: p })),
  )

  const isForcedVibe = playerAction?.forced === true
  const isSprinting = playerAction?.type === 'sprint'
  const isVibing = playerAction?.type === 'vibe'
  const isRefactoring = playerAction?.type === 'refactor'

  function secondsLeft(): number {
    if (!playerAction || playerAction.type === 'sprint' || playerAction.type === 'refactor' || playerAction.type === 'vibe') {
      return 0
    }
    return Math.max(0, Math.ceil((playerAction.duration - playerAction.progress) * 60))
  }

  return (
    <section className="panel actions-panel">
      <div className="panel__header">
        <h2>Your Move</h2>
        <NewGameButton />
      </div>
      <p className="hint">Switch modes freely. Sprint and refactor auto-stop when done.</p>

      {playerAction && (
        <div className="action-status">
          <strong>
            {isSprinting && 'Sprinting…'}
            {isVibing && (isForcedVibe ? 'Forced smoke break…' : 'Vibing…')}
            {playerAction.type === 'review' && `Reviewing… ${secondsLeft()}s`}
            {playerAction.type === 'refine' && `Refining… ${secondsLeft()}s`}
            {isRefactoring && `Refactoring… quality ${Math.floor(selectedProject?.quality ?? 0)}%`}
          </strong>
        </div>
      )}

      {reviewRevealedHit !== null && selectedTask?.status === 'pr_ready' && (
        <div className="review-result">
          <p>Quality hit if merged: <strong>-{reviewRevealedHit.toFixed(1)}</strong></p>
          <div className="action-row">
            <button type="button" className="btn btn--sprint" onClick={() => completeMerge(selectedTask.id)}>
              Merge (reviewed)
            </button>
            <button
              type="button"
              className={`btn ${isRefactoring ? 'btn--active' : ''}`}
              onClick={() => startRefactor(selectedTask.id)}
              disabled={isForcedVibe || (selectedProject?.quality ?? 0) >= 100}
            >
              {isRefactoring ? 'Stop refactor' : 'Refactor first'}
            </button>
          </div>
        </div>
      )}

      <div className="action-row">
        <button
          type="button"
          className={`btn btn--sprint ${isSprinting ? 'btn--active' : ''}`}
          onClick={startSprint}
          disabled={
            isForcedVibe ||
            (!isSprinting &&
              (!selectedTask || selectedTask.status === 'merged' || selectedTask.status === 'pr_ready' || sanity < 5))
          }
        >
          {isSprinting ? 'Stop sprint' : 'Sprint'}
        </button>
        <button
          type="button"
          className={`btn btn--zone ${isVibing ? 'btn--active' : ''}`}
          onClick={startVibe}
          disabled={isForcedVibe}
        >
          {isVibing && !isForcedVibe ? 'Stop vibe' : 'Vibe'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => selectedTask && startRefine(selectedTask.id)}
          disabled={isForcedVibe || !selectedTask || selectedTask.refined || selectedTask.complexity < 6}
        >
          Refine
        </button>
        <button
          type="button"
          className={`btn ${isRefactoring ? 'btn--active' : ''}`}
          onClick={() => selectedTask && startRefactor(selectedTask.id)}
          disabled={isForcedVibe || !selectedTask || (selectedProject?.quality ?? 0) >= 100}
        >
          {isRefactoring ? 'Stop refactor' : 'Refactor'}
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
                <button type="button" className="btn btn--small" onClick={() => startReview(id)} disabled={isForcedVibe}>
                  Review
                </button>
                <button type="button" className="btn btn--small btn--danger" onClick={() => justMerge(id)} disabled={isForcedVibe}>
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
