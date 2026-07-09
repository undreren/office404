import { formatStoryPoints, formatSuccessPct } from '../game/mechanics'
import { projectHasRefineWork } from '../game/projects'
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
  const playerAction = useGameStore((s) => s.playerAction)

  const idleAgents = agents.filter((a) => !a.job && a.status !== 'compacted')
  const isForcedVibe = playerAction?.forced === true

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
        const progress = projectProgressPct(project)
        const merged = project.tasks.filter((t) => t.status === 'merged').length
        const readyToDeliver = isReadyToDeliver(project)
        const openRequirements = project.requirements.filter((r) => r.status === 'open')
        const hasRefineWork = projectHasRefineWork(project)
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
                        : !hasReviewWork

                return (
                  <div key={job} className="crew-row">
                    <span className="crew-label">{label}</span>
                    {assigned.length > 0 ? (
                      <span className="hint">
                        {assigned.map((a) => a.name).join(', ')}
                      </span>
                    ) : (
                      <div className="assign-row">
                        {idleAgents.slice(0, 2).map((a) => {
                          const model = getModel(a.modelId)
                          const hint =
                            job === 'code' && project.tasks[0]
                              ? formatSuccessPct(
                                  modelSuccessForTask(a.modelId, project.tasks[0].storyPointsRequired),
                                )
                              : `${model?.parameters ?? '?'}B`
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
                              className="btn btn--small btn--sprint"
                              onClick={() => mergePr(task.id)}
                              disabled={isForcedVibe}
                            >
                              Merge
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn--small btn--danger"
                            onClick={() => justMergePr(task.id)}
                            disabled={isForcedVibe}
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

            {readyToDeliver && (
              <div className="deliver-row">
                <p className="hint">All tasks merged. Ship it before the client remembers they hired you.</p>
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
