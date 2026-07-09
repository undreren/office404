import { canRefineTask } from '../game/projects'
import { formatStoryPoints, formatSuccessPct } from '../game/mechanics'
import { getModel } from '../game/models'
import {
  isReadyToDeliver,
  modelSuccessForTask,
  projectProgressPct,
  refineSuccessRate,
  useGameStore,
} from '../game/store'

export function ProjectsPanel() {
  const projects = useGameStore((s) => s.projects)
  const selectedTaskId = useGameStore((s) => s.selectedTaskId)
  const agents = useGameStore((s) => s.agents)
  const selectTask = useGameStore((s) => s.selectTask)
  const assignAgent = useGameStore((s) => s.assignAgent)
  const assignAgentToRefine = useGameStore((s) => s.assignAgentToRefine)
  const assignAgentToRefactor = useGameStore((s) => s.assignAgentToRefactor)
  const deliverProject = useGameStore((s) => s.deliverProject)

  const idleAgents = agents.filter((a) => !a.job && a.status !== 'compacted')

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
        const refactorAgent = agents.find((a) => a.job === 'refactor' && a.projectId === project.id)

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

            {project.quality < 100 && (
              <div className="assign-row">
                {refactorAgent ? (
                  <p className="hint">{refactorAgent.name} is refactoring this codebase…</p>
                ) : (
                  idleAgents.slice(0, 3).map((a) => {
                    const model = getModel(a.modelId)
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className="btn btn--small"
                        onClick={() => assignAgentToRefactor(a.id, project.id)}
                      >
                        Refactor → {a.name} ({model?.parameters ?? '?'}B)
                      </button>
                    )
                  })
                )}
              </div>
            )}

            <div className="meter-row">
              <label>Progress ({merged}/{project.tasks.length} merged)</label>
              <div className="meter">
                <div className="meter__fill meter__fill--code" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <ul className="task-list">
              {project.tasks.map((task) => {
                const pct = (task.storyPointsEarned / task.storyPointsRequired) * 100
                const isSelected = selectedTaskId === task.id
                const refiningAgent = agents.find((a) => a.job === 'refine' && a.taskId === task.id)
                const refinePct = refiningAgent && refiningAgent.jobDuration > 0
                  ? Math.min(100, (refiningAgent.jobProgress / refiningAgent.jobDuration) * 100)
                  : 0

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
                        {formatStoryPoints(task.storyPointsEarned)} / {formatStoryPoints(task.storyPointsRequired)} SP
                        {task.refined && ' · refined'}
                        {task.status === 'pr_ready' && task.revealedQualityHit !== null && (
                          <> · review est. -{task.revealedQualityHit.toFixed(1)}</>
                        )}
                      </span>
                    </button>

                    {task.status !== 'merged' && task.status !== 'pr_ready' && !task.assignedAgentId && idleAgents.length > 0 && isSelected && (
                      <div className="assign-row">
                        {idleAgents.slice(0, 4).map((a) => {
                          const rate = modelSuccessForTask(a.modelId, task.storyPointsRequired)
                          return (
                            <button
                              key={a.id}
                              type="button"
                              className="btn btn--small"
                              onClick={() => assignAgent(a.id, task.id)}
                            >
                              Code → {a.name} ({formatSuccessPct(rate)})
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {canRefineTask(task) && task.status !== 'merged' && task.status !== 'pr_ready' && isSelected && (
                      <div className="assign-row">
                        {refiningAgent ? (
                          <p className="hint">{refiningAgent.name} refining… {Math.round(refinePct)}%</p>
                        ) : (
                          idleAgents.slice(0, 3).map((a) => {
                            const model = getModel(a.modelId)
                            const chance = refineSuccessRate(model?.parameters ?? 1, task.storyPointsRequired)
                            return (
                              <button
                                key={a.id}
                                type="button"
                                className="btn btn--small"
                                onClick={() => assignAgentToRefine(a.id, task.id)}
                              >
                                Refine → {a.name} ({formatSuccessPct(chance)} ok)
                              </button>
                            )
                          })
                        )}
                      </div>
                    )}

                    {task.status !== 'merged' && task.status !== 'pr_ready' && isSelected && idleAgents.length === 0 && !refiningAgent && (
                      <p className="hint">No idle agents available.</p>
                    )}
                  </li>
                )
              })}
            </ul>

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
