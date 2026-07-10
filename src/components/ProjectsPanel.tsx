import {
  computeReviewCommentReduction,
  formatStoryPoints,
  formatSuccessPct,
} from '../game/mechanics'
import {
  allImplementationMerged,
  resolvedReviewComments,
  reviewCommentsOnTask,
  syncTestScope,
  untestedMergedTasks,
} from '../game/projects'
import { getModel } from '../game/models'
import type { Agent, AgentJob, Project, Task } from '../game/types'
import {
  isReadyToDeliver,
  modelSuccessForTask,
  projectedQualityHit,
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

function topLevelTasks(project: Project): Task[] {
  return project.tasks.filter((t) => !t.isReviewComment)
}

function commentSummary(project: Project, task: Task, agents: Agent[]) {
  const comments = reviewCommentsOnTask(project, task.id)
  const resolved = resolvedReviewComments(project, task.id).length
  const baseHit = projectedQualityHit(task, agents, project)
  const saved = computeReviewCommentReduction(baseHit, resolved)
  return { comments, resolved, total: comments.length, saved }
}

export function ProjectsPanel() {
  const projects = useGameStore((s) => s.projects)
  const selectedTaskId = useGameStore((s) => s.selectedTaskId)
  const agents = useGameStore((s) => s.agents)
  const selectTask = useGameStore((s) => s.selectTask)
  const assignAgentToProject = useGameStore((s) => s.assignAgentToProject)
  const unassignAgent = useGameStore((s) => s.unassignAgent)
  const justMergePr = useGameStore((s) => s.justMergePr)
  const deliverProject = useGameStore((s) => s.deliverProject)

  const idleAgents = agents.filter(
    (a) => !a.job && a.status !== 'compacted' && a.status !== 'compacting',
  )

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

                return (
                  <div key={job} className="crew-row">
                    <span className="crew-label">{label}</span>
                    <div className="crew-row__content">
                      {assigned.map((a) => (
                        <div key={a.id} className="crew-agent-row">
                          <span className="crew-agent-name">
                            {a.name}
                            {a.job && a.status === 'idle' && ' · idle'}
                            {a.status === 'compacting' && ' · compacting'}
                          </span>
                          <div className="assign-row">
                            {a.job && (
                              <button
                                type="button"
                                className="btn btn--small btn--danger"
                                onClick={() => unassignAgent(a.id)}
                              >
                                Yank
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {idleAgents.length > 0 && (
                        <div className="assign-row">
                          {idleAgents.slice(0, 2).map((a) => {
                            const model = getModel(a.modelId)
                            const hint =
                              job === 'code' && tasks[0]
                                ? formatSuccessPct(
                                    modelSuccessForTask(a.modelId, tasks[0].storyPointsRequired),
                                  )
                                : model
                                  ? `${model.parameters}B · ${model.contextSize}k ctx`
                                  : '?'
                            return (
                              <button
                                key={a.id}
                                type="button"
                                className="btn btn--small"
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

            {tasks.length > 0 && (
              <ul className="task-list">
                {tasks.map((task) => {
                  const pct = (task.storyPointsEarned / task.storyPointsRequired) * 100
                  const testPct =
                    task.status === 'merged'
                      ? (task.testStoryPointsEarned / task.storyPointsRequired) * 100
                      : 0
                  const isSelected = selectedTaskId === task.id
                  const codingAgent = agents.find(
                    (a) => a.job === 'code' && a.taskId === task.id,
                  )
                  const testingAgent = agents.find(
                    (a) => a.job === 'test' && a.taskId === task.id,
                  )
                  const { comments, resolved, total, saved } = commentSummary(project, task, agents)

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
                          {task.status === 'merged' && testPct < 100 && (
                            <> · QA {Math.floor(testPct)}%</>
                          )}
                          {task.status === 'merged' && testPct >= 100 && <> · QA done</>}
                          {codingAgent && ` · ${codingAgent.name} coding`}
                          {testingAgent && ` · ${testingAgent.name} testing`}
                          {task.status === 'pr_ready' && !task.reviewed && ' · awaiting review'}
                          {task.status === 'pr_ready' && task.reviewed && task.revealedQualityHit !== null && (
                            <> · review est. -{task.revealedQualityHit.toFixed(1)}</>
                          )}
                          {task.status === 'pr_ready' && total > 0 && (
                            <> · comments {resolved}/{total}{saved > 0 ? ` (−${saved.toFixed(1)} saved)` : ''}</>
                          )}
                        </span>
                      </button>

                      {comments.length > 0 && (
                        <ul className="review-comment-list">
                          {comments.map((comment) => {
                            const commentPct =
                              (comment.storyPointsEarned / comment.storyPointsRequired) * 100
                            const commentCoder = agents.find(
                              (a) => a.job === 'code' && a.taskId === comment.id,
                            )
                            const addressed = comment.storyPointsEarned >= comment.storyPointsRequired

                            return (
                              <li
                                key={comment.id}
                                className={`review-comment ${addressed ? 'review-comment--resolved' : ''}`}
                              >
                                <div className="review-comment__header">
                                  <span className="review-comment__label">Review comment</span>
                                  {addressed && <span className="review-comment__status">addressed</span>}
                                </div>
                                <p className="review-comment__text">"{comment.title}"</p>
                                <div className="meter meter--sm">
                                  <div
                                    className="meter__fill meter__fill--code"
                                    style={{ width: `${commentPct}%` }}
                                  />
                                </div>
                                <span className="task-sp">
                                  {formatStoryPoints(comment.storyPointsEarned)} /{' '}
                                  {formatStoryPoints(comment.storyPointsRequired)} SP
                                  {commentCoder && ` · ${commentCoder.name} fixing`}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      )}

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
                {implMerged
                  ? 'Implementation merged.'
                  : 'Merged tasks queue for QA as they land.'}{' '}
                Assign a Test agent — {untestedMergedTasks(synced).length} task
                {untestedMergedTasks(synced).length === 1 ? '' : 's'} (
                {formatStoryPoints(
                  synced.testStoryPointsRequired - synced.testStoryPointsCompleted,
                )}{' '}
                SP) waiting.
              </p>
            )}

            {readyToDeliver && (
              <div className="deliver-row">
                <p className="hint">
                  All tasks merged and QA complete. Ship it.
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
