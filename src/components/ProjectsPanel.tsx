import {
  agentWorkProgressPct,
  formatAgentDutyLabel,
  formatStoryPoints,
  hasConductorCourse,
} from '../game/mechanics'
import {
  allImplementationMerged,
  requirementRefineProgressPct,
  requirementTestPercent,
  resolvedReviewComments,
  reviewCommentsOnTask,
  syncTestScope,
  taskIsFullyComplete,
  taskLifecycleLabel,
  taskLifecycleProgressPct,
  tasksForRequirement,
  untestedMergedTasks,
  visibleRequirements,
} from '../game/projects'
import {
  adjustCrewCapMsg,
  adjustRoleCountMsg,
  deliverProjectMsg,
  justMergePrMsg,
  toggleConductorMsg,
} from '../game/messages'
import {
  canStaffAdditionalAgent,
  isReadyToDeliver,
  projectProgressPct,
} from '../game/selectors'
import type { Agent, AgentJob, Project, Requirement, Task } from '../game/types'
import { useGameDispatchAt, useGameState } from '../runtime/GameRuntime'
import { useTabNav } from '../context/TabNavContext'
import { SwipeCarousel } from './SwipeCarousel'

const STAFF_JOBS: { job: AgentJob; label: string }[] = [
  { job: 'refine', label: 'Refine' },
  { job: 'code', label: 'Code' },
  { job: 'review', label: 'Review' },
  { job: 'test', label: 'Test' },
]

function visibleTasksForRequirement(project: Project, requirementId: string): Task[] {
  return tasksForRequirement(project, requirementId)
    .filter((t) => !taskIsFullyComplete(t))
    .sort((a, b) => {
      if (a.isBugFix !== b.isBugFix) return a.isBugFix ? 1 : -1
      return 0
    })
}

function TaskCard({
  task,
  project,
  agents,
  selectedTaskId,
  onJustMerge,
}: {
  task: Task
  project: Project
  agents: Agent[]
  selectedTaskId: string | null
  onJustMerge: (id: string) => void
}) {
  const pct = taskLifecycleProgressPct(task, project, agents)
  const phase = taskLifecycleLabel(task, project)
  const isSelected = selectedTaskId === task.id
  const comments = reviewCommentsOnTask(project, task.id)
  const resolved = resolvedReviewComments(project, task.id).length
  const statusSummary = `${phase}, ${Math.floor(pct)}%, ${formatStoryPoints(task.storyPointsRequired)} story points`

  return (
    <li
      className={`task-item task-item--${task.status} ${isSelected ? 'task-item--selected' : ''} ${task.isBugFix ? 'task-item--bug' : ''}`}
    >
      <article
        className="task-card"
        data-task-id={task.id}
        aria-label={`Task: ${task.title} — ${statusSummary}`}
      >
        <div className="task-item__top">
          <h5 className="task-card__title">{task.title}</h5>
          <span className="task-status">{phase}</span>
        </div>
        <div className="meter meter--sm">
          <div className="meter__fill meter__fill--code" style={{ width: `${pct}%` }} />
        </div>
        <p className="task-sp">
          {Math.floor(pct)}% · {formatStoryPoints(task.storyPointsRequired)} SP
          {task.isBugFix && ' · bug fix'}
          {task.bugDiscovered && !task.isBugFix && ' · bug found'}
          {task.status === 'merged' && task.prQuality !== null && (
            <> · PR {Math.round(task.prQuality)}%</>
          )}
          {task.status === 'pr_ready' && !task.reviewed && ' · awaiting review'}
          {task.status === 'pr_ready' && task.reviewed && (
            <> · PR ~{Math.round(task.prQualityStaging)}%</>
          )}
          {task.status === 'pr_ready' && comments.length > 0 && (
            <> · comments {resolved}/{comments.length}</>
          )}
        </p>
      </article>

      {comments.length > 0 && (
        <ul className="review-comment-list">
          {comments.map((comment) => {
            const commentPct = taskLifecycleProgressPct(comment, project, agents)
            const commentCoder = agents.find((a) => a.job === 'code' && a.taskId === comment.id)
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
                  {Math.floor(commentPct)}% · {formatStoryPoints(comment.storyPointsRequired)} SP
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
            aria-label={`Just merge ${task.title} without waiting for review`}
            onClick={() => onJustMerge(task.id)}
          >
            Just Merge
          </button>
        </div>
      )}
    </li>
  )
}

function RequirementBlock({
  requirement,
  project,
  agents,
  selectedTaskId,
  onJustMerge,
}: {
  requirement: Requirement
  project: Project
  agents: Agent[]
  selectedTaskId: string | null
  onJustMerge: (id: string) => void
}) {
  const refinePct = requirementRefineProgressPct(project, requirement, agents)
  const testPct = requirementTestPercent(project, requirement.id)
  const tasks = visibleTasksForRequirement(project, requirement.id)
  const hasRefinedTasks = requirement.status !== 'open'

  return (
    <li
      className={`requirement-item requirement-item--${requirement.status}`}
      aria-label={`Requirement: ${requirement.title}, ${formatStoryPoints(requirement.storyPoints)} story points, ${requirement.status}`}
    >
      <div className="requirement-item__header">
        <h5 className="requirement-item__title">{requirement.title}</h5>
        <span className="requirement-item__meta">
          {formatStoryPoints(requirement.storyPoints)} SP
          {requirement.status === 'open' && ' · refining'}
          {requirement.status === 'refined' && ' · in progress'}
          {requirement.status === 'split' && ' · split'}
        </span>
      </div>

      {requirement.status === 'open' && (
        <div className="meter-row meter-row--nested">
          <label>Refining</label>
          <div className="meter meter--sm">
            <div
              className="meter__fill meter__fill--code"
              style={{ width: `${refinePct ?? 0}%` }}
            />
          </div>
          <span>{Math.floor(refinePct ?? 0)}%</span>
        </div>
      )}

      {hasRefinedTasks && (
        <div className="meter-row meter-row--nested">
          <label>QA coverage</label>
          <div className="meter meter--sm">
            <div
              className={`meter__fill meter__fill--sanity ${testPct < 100 ? '' : 'meter__fill--code'}`}
              style={{ width: `${Math.min(100, testPct)}%` }}
            />
          </div>
          <span>{Math.floor(testPct)}%</span>
        </div>
      )}

      {tasks.length > 0 && (
        <ul className="task-list task-list--nested" aria-label={`Tasks for ${requirement.title}`}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              project={project}
              agents={agents}
              selectedTaskId={selectedTaskId}
              onJustMerge={onJustMerge}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function AgentCrewRow({ agent, project }: { agent: Agent; project: Project }) {
  const task = agent.taskId ? project.tasks.find((t) => t.id === agent.taskId) : undefined
  const duty = formatAgentDutyLabel(agent, project.clientName, task?.title)
  const progress = agentWorkProgressPct(agent, task ?? null)

  return (
    <div className="crew-agent-row">
      <span className="crew-agent-name">{agent.name}</span>
      {progress !== null ? (
        <>
          <div className="meter meter--sm crew-agent-meter">
            <div className="meter__fill meter__fill--code" style={{ width: `${progress}%` }} />
          </div>
          <span className="crew-agent-progress">{Math.floor(progress)}%</span>
        </>
      ) : (
        <span className="crew-agent-duty">{duty}</span>
      )}
    </div>
  )
}

function RoleCounter({
  projectId,
  job,
  label,
  count,
  canAdd,
  agents,
  project,
}: {
  projectId: string
  job: AgentJob
  label: string
  count: number
  canAdd: boolean
  agents: Agent[]
  project: Project
}) {
  const dispatchAt = useGameDispatchAt()
  const displayCount = Math.max(count, agents.length)
  const canRemove = displayCount > 0

  const staffingLabel = `${label} staffing for ${project.clientName}`

  return (
    <div className="crew-row">
      <div className="crew-row__header">
        <span className="crew-label">{label}</span>
        <div className="crew-counter" role="group" aria-label={staffingLabel}>
          <button
            type="button"
            className="btn btn--small"
            disabled={!canRemove}
            aria-label={`Remove ${label.toLowerCase()} from ${project.clientName}`}
            onClick={() => dispatchAt((at) => adjustRoleCountMsg(at, projectId, job, -1))}
          >
            −
          </button>
          <span className="crew-count" aria-live="polite">
            {displayCount}
          </span>
          <button
            type="button"
            className="btn btn--small"
            disabled={!canAdd}
            aria-label={`Add ${label.toLowerCase()} to ${project.clientName}`}
            onClick={() => dispatchAt((at) => adjustRoleCountMsg(at, projectId, job, 1))}
          >
            +
          </button>
        </div>
      </div>
      {agents.length > 0 && (
        <div className="crew-row__content">
          {agents.map((agent) => (
            <AgentCrewRow key={agent.id} agent={agent} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const state = useGameState()
  const { selectedTaskId, agents, vibingCourses } = state
  const dispatchAt = useGameDispatchAt()

  const canStaff = canStaffAdditionalAgent(state)
  const conductorUnlocked = hasConductorCourse(vibingCourses)

  function projectAgents(projectId: string, job: AgentJob) {
    return agents.filter((a) => a.job === job && a.projectId === projectId)
  }

  const synced = syncTestScope(project)
  const progress = projectProgressPct(project)
  const merged = project.tasks.filter((t) => t.status === 'merged' && !t.isReviewComment).length
  const readyToDeliver = isReadyToDeliver(project)
  const requirements = visibleRequirements(project)
  const implMerged = allImplementationMerged(synced)
  const totalTasks = project.tasks.filter((t) => !t.isReviewComment).length

  return (
    <article
      className={`project-card ${project.isTutorial ? 'project-card--tutorial' : ''} ${readyToDeliver ? 'project-card--ready' : ''}`}
    >
      <header className="project-card__header">
        <div>
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
        <label>Progress ({merged}/{totalTasks || '—'} merged)</label>
        <div className="meter">
          <div className="meter__fill meter__fill--code" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {requirements.length > 0 && (
        <section className="requirements-block" aria-labelledby={`requirements-${project.id}`}>
          <h4 id={`requirements-${project.id}`}>Requirements</h4>
          <ul className="requirement-list">
            {requirements.map((req) => (
              <RequirementBlock
                key={req.id}
                requirement={req}
                project={synced}
                agents={agents}
                selectedTaskId={selectedTaskId}
                onJustMerge={(id) => dispatchAt((at) => justMergePrMsg(at, id))}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="project-crew" aria-labelledby={`staffing-${project.id}`}>
        <h4 id={`staffing-${project.id}`}>Staffing</h4>
        {conductorUnlocked && (
          <div className="crew-row">
            <label className="crew-label">
              <input
                type="checkbox"
                checked={project.useConductor}
                onChange={(e) =>
                  dispatchAt((at) => toggleConductorMsg(at, project.id, e.target.checked))
                }
              />{' '}
              Conductor mode
            </label>
            {project.useConductor && (
              <div className="crew-counter" role="group" aria-label={`Crew cap for ${project.clientName}`}>
                <span className="crew-label">Crew cap</span>
                <button
                  type="button"
                  className="btn btn--small"
                  aria-label={`Decrease crew cap for ${project.clientName}`}
                  onClick={() => dispatchAt((at) => adjustCrewCapMsg(at, project.id, -1))}
                >
                  −
                </button>
                <span className="crew-count">{project.crewCap}</span>
                <button
                  type="button"
                  className="btn btn--small"
                  aria-label={`Increase crew cap for ${project.clientName}`}
                  onClick={() => dispatchAt((at) => adjustCrewCapMsg(at, project.id, 1))}
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
              canAdd={canStaff && project.roleCounts.conductor < 1}
              agents={projectAgents(project.id, 'conductor')}
              project={project}
            />
            <p className="hint">
              Conductor auto-staffs refine → code → review → test within crew cap (
              {projectAgents(project.id, 'conductor').length > 0
                ? `${project.crewCap - 1} worker slots`
                : 'assign conductor first'}
              ).
            </p>
            {STAFF_JOBS.map(({ job, label }) => (
              <RoleCounter
                key={job}
                projectId={project.id}
                job={job}
                label={label}
                count={project.roleCounts[job]}
                canAdd={false}
                agents={projectAgents(project.id, job)}
                project={project}
              />
            ))}
          </>
        ) : (
          STAFF_JOBS.map(({ job, label }) => (
            <RoleCounter
              key={job}
              projectId={project.id}
              job={job}
              label={label}
              count={project.roleCounts[job]}
              canAdd={canStaff}
              agents={projectAgents(project.id, job)}
              project={project}
            />
          ))
        )}
      </section>

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
            onClick={() => dispatchAt((at) => deliverProjectMsg(at, project.id))}
          >
            Deliver to {project.clientName}
          </button>
        </div>
      )}
    </article>
  )
}

export function ProjectsPanel() {
  const { projects } = useGameState()
  const { projectIndex, setProjectIndex } = useTabNav()

  if (projects.length === 0) {
    return (
      <section className="panel projects-panel">
        <h2>Projects</h2>
        <p className="panel__subtitle">Nothing on the board. Leads won&apos;t accept themselves.</p>
        <p className="empty-slot">No active projects. Accept a lead or enjoy unemployment.</p>
      </section>
    )
  }

  const headers = projects.map((project) => ({
    title: project.clientName,
    subtitle: project.clientTagline ? `"${project.clientTagline}"` : undefined,
  }))

  return (
    <SwipeCarousel
      index={projectIndex}
      onIndexChange={setProjectIndex}
      headers={headers}
      panelClassName="projects-panel"
      slides={projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    />
  )
}
