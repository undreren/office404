import { canAgentHandleTask } from '../game/mechanics'
import { getModel } from '../game/models'
import { modelSuccessForTask, projectProgressPct, useGameStore } from '../game/store'

export function ProjectsPanel() {
  const projects = useGameStore((s) => s.projects)
  const selectedTaskId = useGameStore((s) => s.selectedTaskId)
  const agents = useGameStore((s) => s.agents)
  const selectTask = useGameStore((s) => s.selectTask)
  const assignAgent = useGameStore((s) => s.assignAgent)

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

        return (
          <article key={project.id} className={`project-card ${project.isTutorial ? 'project-card--tutorial' : ''}`}>
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
              <label>Progress ({merged}/{project.tasks.length} merged)</label>
              <div className="meter">
                <div className="meter__fill meter__fill--code" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <ul className="task-list">
              {project.tasks.map((task) => {
                const pct = (task.storyPointsEarned / task.storyPointsRequired) * 100
                const isSelected = selectedTaskId === task.id
                const idleAgents = agents.filter((a) => {
                  if (a.taskId || a.status === 'compacted') return false
                  const model = getModel(a.modelId)
                  if (!model) return false
                  return canAgentHandleTask(model.parameters, task.storyPointsRequired)
                })

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
                        {task.storyPointsEarned} / {task.storyPointsRequired} SP
                        {task.refined && ' · refined'}
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
                              → {a.name} ({Math.round(rate * 100)}%)
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {task.status !== 'merged' && task.status !== 'pr_ready' && isSelected && idleAgents.length === 0 && (
                      <p className="hint">No agent can handle {task.storyPointsRequired} SP. Refine or upgrade.</p>
                    )}
                  </li>
                )
              })}
            </ul>
          </article>
        )
      })}
    </section>
  )
}
