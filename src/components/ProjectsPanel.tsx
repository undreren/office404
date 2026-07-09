import { formatStoryPoints, formatSuccessPct } from '../game/mechanics'
import { allImplementationMerged, projectHasRefineWork, projectHasTestWork, syncTestScope } from '../game/projects'
import { getModel } from '../game/models'
import type { AgentJob } from '../game/types'
import {
  isReadyToDeliver,
  modelSuccessForTask,
  projectProgressPct,
  useGameStore,
} from '../game/store'

const PROJECT_JOBS: { job: AgentJob; label: string }[] = [
  { job: 'refine', label: 'Refine' },
  { job: 'code', label: 'Code' },
  { job: 'refactor', label: 'Refactor' },
  { job: 'review', label: 'Review' },
  { job: 'test', label: 'Test' },
]

export function ProjectsPanel() {
  const projects = useGameStore((s) => s.projects)
  const selectedTaskId = useGameStore((s) => s.selectedTaskId)
  const agents = useGameStore((s) => s.agents)
  const selectTask = useGameStore((s) => s.selectTask)
  const assignAgentToProject = useGameStore((s) => s.assignAgentToProject)
  const mergePr = useGameStore((s) => s.mergePr)
  const justMergePr = useGameStore((s) => s.justMergePr)
  const deliverProject = useGameStore((s) => s.deliverProject)

  const idleAgents = agents.filter((a) => !a.job && a.status !== 'compacted')

  function projectAgents(projectId: string, job: AgentJob) {
    return agents.filter((a) => a.job === job && a.projectId === projectId)
  }

  if (projects.length === 0) {
    return (
      <section className="panel projects-panel">
        <h2>Active Projects</h2>
        <p className="empty-slot">No active projects. Accept a lead or enjoy unemployment.</p>
      </section>
    )
  }

  return (
    <section className="panel projects-panel">
      <h2>Active Projects ({projects.length})</h2>

      {projects.map((project) => {
        const synced = syncTestScope(project)
        const progress = projectProgressPct(project)
        const merged = project.tasks.filter((t) => t.status === 'merged').length
        const readyToDeliver = isReadyToDeliver(project)
        const openRequirements = project.requirements.filter((r) => r.status === 'open')
        const hasRefineWork = projectHasRefineWork(project)
        const hasTestWork = projectHasTestWork(synced)
        const implMerged = allImplementationMerged(synced)
        const hasCodeWork = project.tasks.some(
          (t) =>
            (t.status === 'open' || t.status === 'in_progress') &&
            t.storyPointsEarned < t.storyPointsRequired,
        )
        const hasPrWork = project.tasks.some((t) => t.status === 'done')
        const hasReviewWork = project.tasks.some((t) => t.status === 'pr_ready')

        return (
          <article
            key={project.id}
            className={`project-card ${project.isTutorial ? 'project-card--tutorial' : ''} ${readyToDeliver ? 'project-card--ready' : ''}`}
          >
            <header className="project-card__header">
              <div>
                <h3>{project.clientName}</h3>
                <p className="project-blurb">{project.blurb}</p>
              </div>
              <div className="project-meta">
                <span>${project.payment}</span>
                <span className={project.daysRemaining < 5 ? 'text-danger' : ''}>
                  {Math.ceil(project.daysRemaining)}d left
                </span>
              </div>
            </header>

            <div className="meter-row">
              <label>Delivery Quality</label>
              <div className="meter">
                <div
                  className={`meter__fill meter__fill--sanity ${project.quality < 40 ? 'meter__fill--critical' : ''}`}
                  style={{ width: `${project.quality}%` }}
                />
              </div>
              <span>{Math.floor(project.quality)}%</span>
            </div>

            <div className="meter-row">
              <label>Progress ({merged}/{project.tasks.length || '—'} merged)</label>
              <div className="meter">
                <div className="meter__fill meter__fill--code" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {implMerged && (
              <div className="meter-row">
                <label>
                  Test coverage ({formatStoryPoints(synced.testStoryPointsCompleted)} /{' '}
                  {formatStoryPoints(synced.testStoryPointsRequired)} SP)
                </label>
                <div className="meter">
                  <div
                    className={`meter__fill meter__fill--sanity ${synced.testPercent < 100 ? '' : 'meter__fill--code'}`}
                    style={{ width: `${Math.min(100, synced.testPercent)}%` }}
                  />
                </div>
                <span>{Math.floor(synced.testPercent)}%</span>
              </div>
            )}

            {openRequirements.length > 0 && (
              <div className="requirements-block">
                <h4>Requirements ({openRequirements.length} open)</h4>
                <ul className="requirement-list">
                  {project.requirements.map((req) => (
                    <li
                      key={req.id}
                      className={`requirement-item requirement-item--${req.status}`}
                    >
                      <span>{req.title}</span>
                      <span>{formatStoryPoints(req.storyPoints)} SP · {req.status}</span>
                    </li>
                  ))}
                </ul>
                <p className="hint">Assign a Refine agent to turn requirements into tasks.</p>
              </div>
            )}

            <div className="project-crew">
              <h4>Project crew</h4>
              {PROJECT_JOBS.map(({ job, label }) => {
                const assigned = projectAgents(project.id, job)
                const disabled =
                  job === 'refine'
                    ? !hasRefineWork
                    : job === 'code'
                      ? !hasCodeWork && project.tasks.length === 0
                      : job === 'refactor'
                        ? !hasPrWork
                        : job === 'test'
                          ? !hasTestWork
                          : !hasReviewWork

                return (
                  <div key={job} className="crew-row">
                    <span className="crew-label">{label}</span>
                    <div className="crew-row__content">
                      {assigned.length > 0 && (
                        <span className="hint crew-row__assigned">
                          {assigned.map((a) => a.name).join(', ')}
                        </span>
                      )}
                      {idleAgents.length > 0 && (
                        <div className="assign-row">
                          {idleAgents.slice(0, 2).map((a) => {
                            const model = getModel(a.modelId)
                            const hint =
                              job === 'code' && project.tasks[0]
                                ? formatSuccessPct(
                                    modelSuccessForTask(a.modelId, project.tasks[0].storyPointsRequired),
                                  )
                                : model
                                  ? `${model.parameters}B · ${model.contextSize}k ctx`
                                  : '?'
                            return (
                              <button
                                key={a.id}
                                type="button"
                                className="btn btn--small"
                                disabled={disabled}
                                onClick={() => assignAgentToProject(a.id, project.id, job)}
                              >
                                {label} → {a.name} ({hint})
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {project.tasks.length > 0 && (
              <ul className="task-list">
                {project.tasks.map((task) => {
                  const pct = (task.storyPointsEarned / task.storyPointsRequired) * 100
                  const isSelected = selectedTaskId === task.id
                  const codingAgent = agents.find(
                    (a) => a.job === 'code' && a.taskId === task.id,
                  )

                  return (
                    <li
                      key={task.id}
                      className={`task-item task-item--${task.status} ${isSelected ? 'task-item--selected' : ''}`}
                    >
                      <button type="button" className="task-select" onClick={() => selectTask(task.id)}>
                        <div className="task-item__top">
                          <strong>{task.title}</strong>
                          <span className="task-status">{task.status.replace('_', ' ')}</span>
                        </div>
                        <div className="meter meter--sm">
                          <div className="meter__fill meter__fill--code" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="task-sp">
                          {formatStoryPoints(task.storyPointsEarned)} /{' '}
                          {formatStoryPoints(task.storyPointsRequired)} SP
                          {task.refined && ' · refined'}
                          {task.isBugFix && ' · bug fix'}
                          {task.bugDiscovered && ' · bug found'}
                          {task.hasUndiscoveredBug && task.status === 'merged' && !task.bugDiscovered && (
                            <> · untested</>
                          )}
                          {codingAgent && ` · ${codingAgent.name} coding`}
                          {task.status === 'done' && ' · needs PR'}
                          {task.status === 'pr_ready' && task.revealedQualityHit !== null && (
                            <> · review est. -{task.revealedQualityHit.toFixed(1)}</>
                          )}
                          {task.status === 'pr_ready' && task.revealedQualityHit === null && (
                            <> · awaiting review</>
                          )}
                        </span>
                      </button>

                      {task.status === 'pr_ready' && (
                        <div className="assign-row">
                          {task.revealedQualityHit !== null && (
                            <button
                              type="button"
                              className="btn btn--small"
                              onClick={() => mergePr(task.id)}
                            >
                              Merge
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn--small btn--danger"
                            onClick={() => justMergePr(task.id)}
                          >
                            Just Merge
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {implMerged && !readyToDeliver && synced.testPercent < 100 && (
              <p className="hint">
                Implementation merged. Assign a Test agent — QA work equals delivered SP (
                {formatStoryPoints(synced.testStoryPointsRequired)} SP).
              </p>
            )}

            {readyToDeliver && (
              <div className="deliver-row">
                <p className="hint">
                  All tasks merged and QA complete. Ship it — any bugs QA missed will enrage the client.
                </p>
                <button type="button" className="btn btn--deploy" onClick={() => deliverProject(project.id)}>
                  Deliver to {project.clientName}
                </button>
              </div>
            )}
          </article>
        )
      })}
    </section>
  )
}
