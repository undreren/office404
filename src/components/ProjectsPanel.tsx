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
  roleCanAcceptStaffing,
} from '../game/projects'
import {
  adjustCrewCapMsg,
  adjustRoleCountMsg,
  deliverProjectMsg,
  justMergePrMsg,
  toggleConductorMsg,
} from '../game/messages'
import {
  agentCapacity,
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

function staffingAgentLabel(job: AgentJob): string {
  switch (job) {
    case 'code':
      return 'coding agent'
    case 'review':
      return 'review agent'
    case 'refine':
      return 'refining agent'
    case 'test':
      return 'QA agent'
    case 'conductor':
      return 'conductor'
  }
}

function staffingAgentLabelPlural(job: AgentJob, count: number): string {
  const label = staffingAgentLabel(job)
  if (count === 1) return label
  if (job === 'conductor') return 'conductors'
  return `${label}s`
}

function countIdleAgents(agents: Agent[]): number {
  return agents.filter((agent) => agent.job === null).length
}

function staffingAddHint(
  canAdd: boolean,
  hasRoleWork: boolean,
  idleAgents: number,
  rosterUsed: number,
  rosterMax: number,
): string {
  if (!hasRoleWork) return 'no work for this role yet'
  if (!canAdd) {
    if (rosterUsed >= rosterMax) return `roster full (${rosterUsed}/${rosterMax})`
    return 'all agents busy'
  }
  if (idleAgents > 0) return `${idleAgents} idle in roster — assign here`
  return 'room to hire another agent'
}

function staffingGroupLabel(
  job: AgentJob,
  projectName: string,
  assigned: number,
  idleAgents: number,
  rosterUsed: number,
  rosterMax: number,
  hasRoleWork: boolean,
): string {
  const role = staffingAgentLabelPlural(job, assigned)
  const workNote = hasRoleWork ? '' : ', no work for this role'
  return `${role} on ${projectName}: ${assigned} assigned, ${idleAgents} idle on roster (${rosterUsed}/${rosterMax})${workNote}`
}

function taskAccessibleSummary(
  task: Task,
  phase: string,
  pct: number,
  commentCount: number,
  resolvedComments: number,
): string {
  const parts = [
    `${phase}, ${Math.floor(pct)}%, ${formatStoryPoints(task.storyPointsRequired)} story points`,
  ]
  if (task.isBugFix) parts.push('bug fix')
  if (task.bugDiscovered && !task.isBugFix) parts.push('bug found')
  if (task.status === 'merged' && task.prQuality !== null) {
    parts.push(`PR ${Math.round(task.prQuality)}%`)
  }
  if (task.status === 'pr_ready' && !task.reviewed) parts.push('awaiting review')
  if (task.status === 'pr_ready' && task.reviewed) {
    parts.push(`PR ~${Math.round(task.prQualityStaging)}%`)
  }
  if (task.status === 'pr_ready' && commentCount > 0) {
    parts.push(`comments ${resolvedComments}/${commentCount}`)
  }
  return parts.join(', ')
}

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
  const statusSummary = taskAccessibleSummary(task, phase, pct, comments.length, resolved)

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

            const commentSummary = [
              `Review comment: "${comment.title}"`,
              addressed ? 'addressed' : `${Math.floor(commentPct)}% complete`,
              `${formatStoryPoints(comment.storyPointsRequired)} story points`,
              commentCoder ? `${commentCoder.name} fixing` : null,
            ]
              .filter(Boolean)
              .join(', ')

            return (
              <li
                key={comment.id}
                className={`review-comment ${addressed ? 'review-comment--resolved' : ''}`}
                aria-label={commentSummary}
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
  const requirementSummary = [
    `Requirement: ${requirement.title}`,
    `${formatStoryPoints(requirement.storyPoints)} story points`,
    requirement.status,
    requirement.status === 'open' && refinePct !== null
      ? `refining ${Math.floor(refinePct)}%`
      : null,
    hasRefinedTasks ? `QA coverage ${Math.floor(testPct)}%` : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <li
      className={`requirement-item requirement-item--${requirement.status}`}
      aria-label={requirementSummary}
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

  const agentSummary =
    progress !== null
      ? `${agent.name}: ${duty}, ${Math.floor(progress)}%`
      : `${agent.name}: ${duty}`

  return (
    <div className="crew-agent-row" aria-label={agentSummary}>
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
  idleAgents,
  rosterUsed,
  rosterMax,
  hasRoleWork,
}: {
  projectId: string
  job: AgentJob
  label: string
  count: number
  canAdd: boolean
  agents: Agent[]
  project: Project
  idleAgents: number
  rosterUsed: number
  rosterMax: number
  hasRoleWork: boolean
}) {
  const dispatchAt = useGameDispatchAt()
  const displayCount = Math.max(count, agents.length)
  const canRemove = displayCount > 0
  const agentLabel = staffingAgentLabel(job)
  const agentLabelPlural = staffingAgentLabelPlural(job, displayCount)
  const addHint = staffingAddHint(canAdd, hasRoleWork, idleAgents, rosterUsed, rosterMax)

  const staffingLabel = staffingGroupLabel(
    job,
    project.clientName,
    displayCount,
    idleAgents,
    rosterUsed,
    rosterMax,
    hasRoleWork,
  )

  return (
    <div className="crew-row">
      <div className="crew-row__header">
        <span className="crew-label">{label}</span>
        <div className="crew-counter" role="group" aria-label={staffingLabel}>
          <button
            type="button"
            className="btn btn--small"
            disabled={!canRemove}
            aria-label={
              canRemove
                ? `Unassign ${agentLabel} from ${project.clientName} (${displayCount} assigned)`
                : `Unassign ${agentLabel} from ${project.clientName} (none assigned)`
            }
            data-testid={`staffing-remove-${job}-${projectId}`}
            onClick={() => dispatchAt((at) => adjustRoleCountMsg(at, projectId, job, -1))}
          >
            −
          </button>
          <span className="crew-count" aria-label={`${displayCount} ${agentLabelPlural} assigned`}>
            {displayCount}
          </span>
          <button
            type="button"
            className="btn btn--small"
            disabled={!canAdd}
            aria-label={`Assign ${agentLabel} to ${project.clientName} (${displayCount} assigned, ${addHint})`}
            data-testid={`staffing-add-${job}-${projectId}`}
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
  const { used: rosterUsed, max: rosterMax } = agentCapacity(state)
  const idleAgents = countIdleAgents(agents)

  function projectAgents(projectId: string, job: AgentJob) {
    return agents.filter((a) => a.job === job && a.projectId === projectId)
  }

  function roleCanAdd(job: AgentJob): boolean {
    return canStaff && roleCanAcceptStaffing(synced, job, agents)
  }

  const synced = syncTestScope(project)
  const progress = projectProgressPct(project)
  const merged = project.tasks.filter((t) => t.status === 'merged' && !t.isReviewComment).length
  const readyToDeliver = isReadyToDeliver(project)
  const requirements = visibleRequirements(project)
  const implMerged = allImplementationMerged(synced)
  const totalTasks = project.tasks.filter((t) => !t.isReviewComment).length

  const projectSummary = [
    project.clientName,
    `$${project.payment}`,
    `${Math.ceil(project.daysRemaining)} days left`,
    `delivery quality ${Math.floor(synced.deliveryQuality)}%`,
    `progress ${merged}/${totalTasks || 0} merged`,
  ].join(', ')

  return (
    <article
      className={`project-card ${project.isTutorial ? 'project-card--tutorial' : ''} ${readyToDeliver ? 'project-card--ready' : ''}`}
      aria-label={projectSummary}
    >
      <header className="project-card__header">
        <div>
          <p className="project-blurb" aria-label={`Project brief: ${project.blurb}`}>
            {project.blurb}
          </p>
        </div>
        <div
          className="project-meta"
          role="group"
          aria-label={`Payment $${project.payment}, ${Math.ceil(project.daysRemaining)} days left`}
        >
          <span>${project.payment}</span>
          <span className={project.daysRemaining < 5 ? 'text-danger' : ''}>
            {Math.ceil(project.daysRemaining)}d left
          </span>
        </div>
      </header>

      <div
        className="meter-row"
        role="group"
        aria-label={`Delivery Quality (avg PR): ${Math.floor(synced.deliveryQuality)}%`}
      >
        <label>Delivery Quality (avg PR)</label>
        <div className="meter">
          <div
            className={`meter__fill meter__fill--sanity ${synced.deliveryQuality < 40 ? 'meter__fill--critical' : ''}`}
            style={{ width: `${synced.deliveryQuality}%` }}
          />
        </div>
        <span>{Math.floor(synced.deliveryQuality)}%</span>
      </div>

      <div
        className="meter-row"
        role="group"
        aria-label={`Progress: ${merged}/${totalTasks || 0} merged, ${Math.floor(progress)}%`}
      >
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

      <section
        className="project-crew"
        aria-labelledby={`staffing-${project.id}`}
        aria-describedby={`staffing-roster-${project.id}`}
      >
        <h4 id={`staffing-${project.id}`}>Staffing</h4>
        <button
          type="button"
          disabled
          id={`staffing-roster-${project.id}`}
          className="hint staffing-roster-summary"
          data-testid="staffing-roster-summary"
          aria-label={`Roster: ${agents.length} agent${agents.length === 1 ? '' : 's'}, ${idleAgents} idle${
            rosterUsed < rosterMax
              ? `, ${rosterMax - rosterUsed} hire slot${rosterMax - rosterUsed === 1 ? '' : 's'} left`
              : ', roster full'
          }`}
        >
          Roster: {agents.length} agent{agents.length === 1 ? '' : 's'}, {idleAgents} idle
          {rosterUsed < rosterMax
            ? ` (${rosterMax - rosterUsed} hire slot${rosterMax - rosterUsed === 1 ? '' : 's'} left)`
            : ' (full)'}
        </button>
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
              idleAgents={idleAgents}
              rosterUsed={rosterUsed}
              rosterMax={rosterMax}
              hasRoleWork
            />
            <p
              className="hint"
              aria-label={`Conductor auto-staffs refine, code, review, and test within crew cap (${
                projectAgents(project.id, 'conductor').length > 0
                  ? `${project.crewCap - 1} worker slots`
                  : 'assign conductor first'
              }).`}
            >
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
                idleAgents={idleAgents}
                rosterUsed={rosterUsed}
                rosterMax={rosterMax}
                hasRoleWork={roleCanAcceptStaffing(synced, job, agents)}
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
              canAdd={roleCanAdd(job)}
              agents={projectAgents(project.id, job)}
              project={project}
              idleAgents={idleAgents}
              rosterUsed={rosterUsed}
              rosterMax={rosterMax}
              hasRoleWork={roleCanAcceptStaffing(synced, job, agents)}
            />
          ))
        )}
      </section>

      {synced.testStoryPointsRequired > 0 && !readyToDeliver && synced.testPercent < 100 && (
        <p
          className="hint"
          aria-label={`${
            implMerged ? 'Implementation merged.' : 'Merged tasks queue for QA as they land.'
          } ${untestedMergedTasks(synced).length} task${
            untestedMergedTasks(synced).length === 1 ? '' : 's'
          } waiting for QA.`}
        >
          {implMerged ? 'Implementation merged.' : 'Merged tasks queue for QA as they land.'}{' '}
          {untestedMergedTasks(synced).length} task
          {untestedMergedTasks(synced).length === 1 ? '' : 's'} waiting for QA.
        </p>
      )}

      {readyToDeliver && (
        <div className="deliver-row">
          <p className="hint" aria-label="All tasks merged and QA complete. Ship it.">
            All tasks merged and QA complete. Ship it.
          </p>
          <button
            type="button"
            className="btn btn--deploy"
            data-testid={`deliver-${project.id}`}
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
        <p className="empty-slot" aria-label="No active projects. Accept a lead or enjoy unemployment.">
          No active projects. Accept a lead or enjoy unemployment.
        </p>
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
