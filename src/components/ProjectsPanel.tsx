import { formatStoryPoints } from '../game/mechanics'
import { hasConductorCourse } from '../game/mechanics'
import {
  allImplementationMerged,
  resolvedReviewComments,
  reviewCommentsOnTask,
  syncTestScope,
  untestedMergedTasks,
} from '../game/projects'
import type { AgentJob, Project, Task } from '../game/types'
import { agentCapacity, isReadyToDeliver, projectProgressPct, useGameStore } from '../game/store'

const STAFF_JOBS: { job: AgentJob; label: string }[] = [
  { job: 'refine', label: 'Refine' },
  { job: 'code', label: 'Code' },
  { job: 'review', label: 'Review' },
  { job: 'test', label: 'Test' },
]

function topLevelTasks(project: Project): Task[] {
  return project.tasks.filter((t) => !t.isReviewComment)
}

function RoleCounter({
  projectId,
  job,
  label,
  count,
  canAdd,
}: {
  projectId: string
  job: AgentJob
  label: string
  count: number
  canAdd: boolean
}) {
  const adjustRoleCount = useGameStore((s) => s.adjustRoleCount)

  return (
    <div className="crew-row">
      <span className="crew-label">{label}</span>
      <div className="crew-counter">
        <button
          type="button"
          className="btn btn--small"
          disabled={count <= 0}
          onClick={() => adjustRoleCount(projectId, job, -1)}
        >
          −
        </button>
        <span className="crew-count">{count}</span>
        <button
          type="button"
          className="btn btn--small"
          disabled={!canAdd}
          onClick={() => adjustRoleCount(projectId, job, 1)}
        >
          +
        </button>
      </div>
    </div>
  )
}

export function ProjectsPanel() {
  const projects = useGameStore((s) => s.projects)
  const selectedTaskId = useGameStore((s) => s.selectedTaskId)
  const agents = useGameStore((s) => s.agents)
  const vibingCourses = useGameStore((s) => s.vibingCourses)
  const state = useGameStore()
  const selectTask = useGameStore((s) => s.selectTask)
  const justMergePr = useGameStore((s) => s.justMergePr)
  const deliverProject = useGameStore((s) => s.deliverProject)
  const adjustCrewCap = useGameStore((s) => s.adjustCrewCap)
  const toggleConductor = useGameStore((s) => s.toggleConductor)

  const { max } = agentCapacity(state)
  const canSpawn = agents.length < max
  const conductorUnlocked = hasConductorCourse(vibingCourses)

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
        const merged = project.tasks.filter((t) => t.status === 'merged' && !t.isReviewComment).length
        const readyToDeliver = isReadyToDeliver(project)
        const openRequirements = project.requirements.filter((r) => r.status === 'open')
        const implMerged = allImplementationMerged(synced)
        const tasks = topLevelTasks(project)

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
              <label>Delivery Quality (avg PR)</label>
              <div className="meter">
                <div
                  className={`meter__fill meter__fill--sanity ${synced.deliveryQuality < 40 ? 'meter__fill--critical' : ''}`}
                  style={{ width: `${synced.deliveryQuality}%` }}
                />
              </div>
              <span>{Math.floor(synced.deliveryQuality)}%</span>
            </div>

            <div className="meter-row">
              <label>Progress ({merged}/{tasks.length || '—'} merged)</label>
              <div className="meter">
                <div className="meter__fill meter__fill--code" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {synced.testStoryPointsRequired > 0 && (
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
                      <span>
                        {formatStoryPoints(req.storyPoints)} SP · {req.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="project-crew">
              <h4>Staffing</h4>
              {conductorUnlocked && (
                <div className="crew-row">
                  <label className="crew-label">
                    <input
                      type="checkbox"
                      checked={project.useConductor}
                      onChange={(e) => toggleConductor(project.id, e.target.checked)}
                    />{' '}
                    Conductor mode
                  </label>
                  {project.useConductor && (
                    <div className="crew-counter">
                      <span className="crew-label">Crew cap</span>
                      <button
                        type="button"
                        className="btn btn--small"
                        onClick={() => adjustCrewCap(project.id, -1)}
                      >
                        −
                      </button>
                      <span className="crew-count">{project.crewCap}</span>
                      <button
                        type="button"
                        className="btn btn--small"
                        onClick={() => adjustCrewCap(project.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              )}

              {project.useConductor && conductorUnlocked ? (
                <>
                  <RoleCounter
                    projectId={project.id}
                    job="conductor"
                    label="Conductor"
                    count={project.roleCounts.conductor}
                    canAdd={canSpawn && project.roleCounts.conductor < 1}
                  />
                  <p className="hint">
                    Conductor auto-staffs refine → code → review → test within crew cap (
                    {projectAgents(project.id, 'conductor').length > 0
                      ? `${project.crewCap - 1} worker slots`
                      : 'assign conductor first'}
                    ).
                  </p>
                </>
              ) : (
                STAFF_JOBS.map(({ job, label }) => (
                  <RoleCounter
                    key={job}
                    projectId={project.id}
                    job={job}
                    label={label}
                    count={project.roleCounts[job]}
                    canAdd={canSpawn}
                  />
                ))
              )}

              <AgentsPanelInline projectId={project.id} />
            </div>

            {tasks.length > 0 && (
              <ul className="task-list">
                {tasks.map((task) => {
                  const pct = (task.storyPointsEarned / task.storyPointsRequired) * 100
                  const testPct =
                    task.status === 'merged'
                      ? (task.testStoryPointsEarned / task.storyPointsRequired) * 100
                      : 0
                  const isSelected = selectedTaskId === task.id
                  const comments = reviewCommentsOnTask(project, task.id)
                  const resolved = resolvedReviewComments(project, task.id).length

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
                          {task.isBugFix && ' · bug fix'}
                          {task.bugDiscovered && ' · bug found'}
                          {task.status === 'merged' && task.prQuality !== null && (
                            <> · PR {Math.round(task.prQuality)}%</>
                          )}
                          {task.status === 'merged' && testPct < 100 && (
                            <> · QA {Math.floor(testPct)}%</>
                          )}
                          {task.status === 'pr_ready' && !task.reviewed && ' · awaiting review'}
                          {task.status === 'pr_ready' && task.reviewed && (
                            <> · PR ~{Math.round(task.prQualityStaging)}%</>
                          )}
                          {task.status === 'pr_ready' && comments.length > 0 && (
                            <> · comments {resolved}/{comments.length}</>
                          )}
                        </span>
                      </button>

                      {task.status === 'pr_ready' && (
                        <div className="assign-row">
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

            {synced.testStoryPointsRequired > 0 && !readyToDeliver && synced.testPercent < 100 && (
              <p className="hint">
                {implMerged ? 'Implementation merged.' : 'Merged tasks queue for QA as they land.'}{' '}
                {untestedMergedTasks(synced).length} task
                {untestedMergedTasks(synced).length === 1 ? '' : 's'} waiting for QA.
              </p>
            )}

            {readyToDeliver && (
              <div className="deliver-row">
                <p className="hint">All tasks merged and QA complete. Ship it.</p>
                <button
                  type="button"
                  className="btn btn--deploy"
                  onClick={() => deliverProject(project.id)}
                >
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

function AgentsPanelInline({ projectId }: { projectId: string }) {
  const agents = useGameStore((s) => s.agents)
  const projects = useGameStore((s) => s.projects)
  const projectAgents = agents.filter((a) => a.projectId === projectId)

  if (projectAgents.length === 0) return null

  return (
    <ul className="agent-mini-list agent-mini-list--inline">
      {projectAgents.map((agent) => {
        const project = projects.find((p) => p.id === projectId)
        const task = agent.taskId
          ? project?.tasks.find((t) => t.id === agent.taskId)
          : undefined
        const duty =
          agent.job === 'conductor'
            ? 'Conducting'
            : agent.job
              ? `${agent.job}${agent.status === 'idle' ? ' (idle)' : ''}`
              : '—'

        return (
          <li key={agent.id} className="agent-mini-card">
            <span className="agent-mini-card__name">{agent.name}</span>
            <span className="agent-mini-card__duty">
              {duty}
              {task ? ` · ${task.title.slice(0, 24)}` : project ? ` · ${project.clientName}` : ''}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
