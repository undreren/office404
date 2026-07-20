import { useEffect, useRef } from 'react'
import {
  activeClientProjectInSlot,
  agentContextDisplayPct,
  agentContextTokenCapacity,
  availableLeadInSlot,
  countRosterIdleAgents,
  formatAgentProjectViewDutyLabel,
  formatPercent,
  formatStoryPoints,
  hasConductorCourse,
  hasOpenClientProjectSlot,
  clientProjectBoardSlots,
  taskEarnedTokens,
  taskTokensRequired,
} from '../game/mechanics'
import { pmAbsorbsClientConductor } from '../game/hallucinationAutomation'
import { getHallucinationLevel } from '../game/meta'
import {
  agentsPerTaskForProject,
  allImplementationMerged,
  effectiveLeadDuration,
  requirementRefineProgressPct,
  requirementTestPercent,
  resolvedReviewComments,
  reviewCommentsOnTask,
  syncTestScope,
  taskIsFullyComplete,
  taskLifecycleLabel,
  taskLifecycleProgressPct,
  taskNeedsRefinement,
  taskRefineProgressPct,
  tasksForRequirement,
  untestedMergedTasks,
  visibleRequirements,
  roleCanAcceptStaffing,
} from '../game/projects'
import {
  adjustRoleCountMsg,
  deliverProjectMsg,
  rejectLeadMsg,
  toggleConductorMsg,
} from '../game/messages'
import {
  agentCapacity,
  canStaffRoleOnProject,
  isReadyToDeliver,
  projectProgressPct,
} from '../game/selectors'
import type { Agent, AgentJob, Lead, Project, Requirement, StaffJob, Task } from '../game/types'
import { useGameDispatchAt, useGameState } from '../runtime/GameRuntime'
import { useTabNav } from '../context/TabNavContext'

const STAFF_JOBS: { job: StaffJob; label: string }[] = [
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
    default:
      return 'agent'
  }
}

function staffingAgentLabelPlural(job: AgentJob, count: number): string {
  const label = staffingAgentLabel(job)
  if (count === 1) return label
  if (job === 'conductor') return 'conductors'
  return `${label}s`
}

function staffingAddHint(
  canAdd: boolean,
  hasRoleWork: boolean,
  idleAgents: number,
  rosterUsed: number,
  rosterMax: number,
): string {
  if (!canAdd) {
    if (rosterUsed >= rosterMax) return `roster full (${rosterUsed}/${rosterMax})`
    return 'all agents busy'
  }
  if (!hasRoleWork) return 'no work for this role yet — agent will idle'
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
  tokenLabel: string,
): string {
  const parts = [`${phase}, ${formatPercent(pct)}%, ${tokenLabel}`]
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
}: {
  task: Task
  project: Project
  agents: Agent[]
  selectedTaskId: string | null
}) {
  const refining = taskNeedsRefinement(task)
  const refinePct = refining ? taskRefineProgressPct(task, project, agents) : null
  const pct = refining ? (refinePct ?? 0) : taskLifecycleProgressPct(task, project, agents)
  const phase = taskLifecycleLabel(task, project)
  const isSelected = selectedTaskId === task.id
  const comments = reviewCommentsOnTask(project, task.id)
  const resolved = resolvedReviewComments(project, task.id).length
  const workRole = refining ? 'refine' : task.isReviewComment ? 'code' : task.status === 'done' || task.status === 'merged' ? 'test' : 'code'
  const tokenRequired = taskTokensRequired(task.storyPointsRequired, workRole)
  const tokenEarned = Math.min(tokenRequired, taskEarnedTokens(task, workRole))
  const tokenLabel = `${Math.round(tokenEarned)}/${Math.round(tokenRequired)} tok · ${formatStoryPoints(task.storyPointsRequired)} SP`
  const refiner = refining
    ? agents.find((a) => a.job === 'refine' && a.projectId === project.id && a.taskId === task.id)
    : undefined
  const statusSummary = taskAccessibleSummary(task, phase, pct, comments.length, resolved, tokenLabel)

  return (
    <li
      className={`task-item task-item--${task.status} ${isSelected ? 'task-item--selected' : ''} ${task.isBugFix ? 'task-item--bug' : ''} ${refining ? 'task-item--refining' : ''}`}
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
          <div
            className={`meter__fill ${refining ? 'meter__fill--refine' : 'meter__fill--code'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="task-sp">
          {formatPercent(pct)}% · {tokenLabel}
          {refining && ' · refining'}
          {refining && refiner && ` · ${refiner.name}`}
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
              addressed ? 'addressed' : `${formatPercent(commentPct)}% complete`,
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
                  {formatPercent(commentPct)}% · {formatStoryPoints(comment.storyPointsRequired)} SP
                  {commentCoder && ` · ${commentCoder.name} fixing`}
                </span>
              </li>
            )
          })}
        </ul>
      )}

    </li>
  )
}

function RequirementBlock({
  requirement,
  project,
  agents,
  selectedTaskId,
}: {
  requirement: Requirement
  project: Project
  agents: Agent[]
  selectedTaskId: string | null
}) {
  const refinePct = requirementRefineProgressPct(project, requirement, agents)
  const testPct = requirementTestPercent(project, requirement.id)
  const tasks = visibleTasksForRequirement(project, requirement.id)
  const refinableTasks = tasks.filter(taskNeedsRefinement)
  const requirementStillRefining = refinableTasks.length > 0
  const taskRefinePct =
    requirement.status !== 'open' && requirementStillRefining
      ? Math.max(
          ...refinableTasks.map((task) => taskRefineProgressPct(task, project, agents) ?? 0),
        )
      : null
  const hasRefinedTasks = requirement.status !== 'open'
  const requirementSummary = [
    `Requirement: ${requirement.title}`,
    `${formatStoryPoints(requirement.storyPoints)} story points`,
    requirement.status,
    (requirement.status === 'open' || requirementStillRefining) && (refinePct ?? taskRefinePct) !== null
      ? `refining ${formatPercent(refinePct ?? taskRefinePct ?? 0)}%`
      : null,
    hasRefinedTasks ? `QA coverage ${formatPercent(testPct)}%` : null,
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
          {(requirement.status === 'open' || requirementStillRefining) && ' · refining'}
          {requirement.status === 'refined' && !requirementStillRefining && ' · in progress'}
          {requirement.status === 'split' && !requirementStillRefining && ' · split'}
        </span>
      </div>

      {(requirement.status === 'open' || requirementStillRefining) && (
        <div className="meter-row meter-row--nested">
          <label>Refining</label>
          <div className="meter meter--sm">
            <div
              className="meter__fill meter__fill--code"
              style={{ width: `${refinePct ?? taskRefinePct ?? 0}%` }}
            />
          </div>
          <span>{formatPercent(refinePct ?? taskRefinePct ?? 0)}%</span>
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
          <span>{formatPercent(testPct)}%</span>
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
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function AgentCrewRow({ agent, project }: { agent: Agent; project: Project }) {
  const { meta } = useGameState()
  const contextTokens = agentContextTokenCapacity(getHallucinationLevel(meta, 'context'))
  const task = agent.taskId ? project.tasks.find((t) => t.id === agent.taskId) : undefined
  const duty = formatAgentProjectViewDutyLabel(agent, task?.title)
  const fill = agentContextDisplayPct(agent, contextTokens)
  const isCompacting = agent.status === 'compacting'

  const agentSummary = [
    agent.name,
    duty,
    `${formatPercent(fill)}% context`,
    isCompacting ? 'compacting' : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div
      className={`crew-agent-row${isCompacting ? ' crew-agent-row--compacting' : ''}`}
      aria-label={agentSummary}
    >
      <span className="crew-agent-name">{agent.name}</span>
      {duty && <span className="crew-agent-duty">{duty}</span>}
      <span className={`crew-agent-ctx${isCompacting ? ' crew-agent-ctx--draining' : ''}`}>
        {formatPercent(fill)}% ctx
      </span>
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

export function ProjectCard({ project }: { project: Project }) {
  const state = useGameState()
  const { selectedTaskId, agents, vibingCourses, vibingCourseTiers, meta } = state
  const dispatchAt = useGameDispatchAt()

  const conductorUnlocked =
    hasConductorCourse(vibingCourses) ||
    (project.kind === 'client' && pmAbsorbsClientConductor(meta, agents))
  const { used: rosterUsed, max: rosterMax } = agentCapacity(state)
  const idleAgents = countRosterIdleAgents(agents)

  function projectAgents(projectId: string, job: AgentJob) {
    return agents.filter((a) => a.job === job && a.projectId === projectId)
  }

  function roleCanAdd(job: AgentJob): boolean {
    return canStaffRoleOnProject(state, project.id, job)
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
    `delivery quality ${formatPercent(synced.deliveryQuality)}%`,
    `progress ${merged}/${totalTasks || 0} merged`,
  ].join(', ')

  return (
    <article
      className={`project-card ${project.isTutorial ? 'project-card--tutorial' : ''} ${readyToDeliver ? 'project-card--ready' : ''} ${project.isLocked ? 'project-card--locked' : ''}`}
      aria-label={projectSummary}
    >
      {project.isLocked && (
        <p
          className="hint text-danger project-card__locked"
          data-testid={`project-locked-${project.id}`}
          aria-label="Project locked until the client project cap is raised on Status."
        >
          Locked — raise the client project cap on Status to work this gig.
        </p>
      )}
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
        aria-label={`Delivery Quality (avg PR): ${formatPercent(synced.deliveryQuality)}%`}
      >
        <label>Delivery Quality (avg PR)</label>
        <div className="meter">
          <div
            className={`meter__fill meter__fill--sanity ${synced.deliveryQuality < 40 ? 'meter__fill--critical' : ''}`}
            style={{ width: `${synced.deliveryQuality}%` }}
          />
        </div>
        <span>{formatPercent(synced.deliveryQuality)}%</span>
      </div>

      <div
        className="meter-row"
        role="group"
        aria-label={`Progress: ${merged}/${totalTasks || 0} merged, ${formatPercent(progress)}%`}
      >
        <label>Progress ({merged}/{totalTasks || '—'} merged)</label>
        <div className="meter">
          <div className="meter__fill meter__fill--code" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {requirements.length > 0 && !project.isLocked && (
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
              />
            ))}
          </ul>
        </section>
      )}

      {!project.isLocked && (
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
          </div>
        )}

        {project.useConductor && conductorUnlocked ? (
          <>
            {projectAgents(project.id, 'conductor').length > 0 && (
              <div className="crew-row__content">
                {projectAgents(project.id, 'conductor').map((agent) => (
                  <AgentCrewRow key={agent.id} agent={agent} project={project} />
                ))}
              </div>
            )}
            <p
              className="hint"
              aria-label="Conductor auto-staffs refine, code, review, and test. Projects compete for roster agents."
            >
              Conductor auto-staffs refine → code → review → test. Projects compete for roster
              agents.
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
                hasRoleWork={roleCanAcceptStaffing(
                  synced,
                  job,
                  agents,
                  agentsPerTaskForProject(synced, job, agents, vibingCourseTiers),
                )}
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
              hasRoleWork={roleCanAcceptStaffing(
                synced,
                job,
                agents,
                agentsPerTaskForProject(synced, job, agents, vibingCourseTiers),
              )}
            />
          ))
        )}
      </section>
      )}

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

      {readyToDeliver && !project.isLocked && (
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

function LeadColumnCard({
  lead,
  gameDay,
  canAccept,
  onAccept,
  onReject,
}: {
  lead: Lead
  gameDay: number
  canAccept: boolean
  onAccept: () => void
  onReject: () => void
}) {
  const effectiveDays = effectiveLeadDuration(lead, gameDay)
  const waitPenalty = lead.durationDays - effectiveDays
  const leadSummary = [
    lead.clientName,
    `${effectiveDays} day deadline`,
    waitPenalty > 0 ? `minus ${waitPenalty} days for waiting` : null,
    `$${lead.payment} on completion`,
    `${lead.totalStoryPoints} story points total`,
    lead.repRequired > 0 ? `${lead.repRequired} rep required` : null,
    canAccept ? 'can accept' : 'cannot accept',
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <article className="lead-card lead-card--column" aria-label={leadSummary}>
      <header>
        <h3>{lead.clientName}</h3>
      </header>
      {lead.clientTagline && (
        <p className="client-tagline" aria-label={`Client tagline: "${lead.clientTagline}"`}>
          "{lead.clientTagline}"
        </p>
      )}
      <p aria-label={`Lead brief: ${lead.blurb}`}>{lead.blurb}</p>
      <ul className="lead-stats" aria-label="Lead stats">
        <li>{lead.totalStoryPoints} SP total</li>
        <li>
          {effectiveDays} day deadline
          {waitPenalty > 0 && ` (−${waitPenalty}d for waiting)`}
        </li>
        <li>${lead.payment} on completion</li>
        {lead.repRequired > 0 && <li>{lead.repRequired} rep required</li>}
      </ul>
      <div className="action-row">
        <button
          type="button"
          className="btn btn--deploy"
          aria-label={`Accept lead from ${lead.clientName}`}
          onClick={onAccept}
          disabled={!canAccept}
        >
          Accept
        </button>
        <button
          type="button"
          className="btn btn--small"
          aria-label={`Reject lead from ${lead.clientName}`}
          onClick={onReject}
        >
          Reject
        </button>
      </div>
    </article>
  )
}

export function ProjectsPanel() {
  const { projects, leads, reputation, gameDay, tutorialDone, meta, agents, vibingCourseTiers, maxClientProjects } =
    useGameState()
  const { projectIndex, setProjectIndex, acceptLead } = useTabNav()
  const dispatchAt = useGameDispatchAt()
  const columnsRef = useRef<HTMLDivElement>(null)
  const slotState = { meta, vibingCourseTiers, maxClientProjects }
  const columnCount = tutorialDone ? clientProjectBoardSlots(slotState, projects, leads) : 1
  const canAcceptLeads = hasOpenClientProjectSlot(slotState, agents, projects)

  useEffect(() => {
    const container = columnsRef.current
    if (!container) return
    const column = container.querySelector<HTMLElement>(`[data-slot-index="${projectIndex}"]`)
    column?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }, [projectIndex])

  return (
    <section className="panel projects-panel">
      <header className="project-columns__header">
        <h2>Projects</h2>
        <p className="panel__subtitle">
          Client columns — leads arrive empty, projects ship full, the universe refills the slot.
        </p>
      </header>

      <div ref={columnsRef} className="project-columns" role="list" aria-label="Client project columns">
        {Array.from({ length: columnCount }, (_, slot) => {
          const project =
            activeClientProjectInSlot(projects, slot) ??
            (!tutorialDone ? projects.find((p) => p.isTutorial) : undefined)
          const lead = !project && tutorialDone ? availableLeadInSlot(leads, slot) : undefined
          const columnLabel = project
            ? project.clientName
            : lead
              ? `Lead: ${lead.clientName}`
              : `Column ${slot + 1}`
          const isFocused = projectIndex === slot

          return (
            <section
              key={slot}
              data-slot-index={slot}
              className={`project-column ${isFocused ? 'project-column--focused' : ''} ${project && isReadyToDeliver(project) ? 'project-column--deliverable' : ''}`}
              role="listitem"
              aria-label={columnLabel}
              onClick={() => setProjectIndex(slot)}
            >
              <header className="project-column__header">
                <h3>{project?.clientName ?? lead?.clientName ?? 'Open slot'}</h3>
                {project?.clientTagline && (
                  <p className="project-column__subtitle">"{project.clientTagline}"</p>
                )}
                {lead?.clientTagline && (
                  <p className="project-column__subtitle">"{lead.clientTagline}"</p>
                )}
                {!project && !lead && tutorialDone && (
                  <p className="project-column__subtitle">Waiting for the next client lead.</p>
                )}
              </header>

              <div className="project-column__body">
                {project && <ProjectCard project={project} />}
                {lead && (
                  <LeadColumnCard
                    lead={lead}
                    gameDay={gameDay}
                    canAccept={canAcceptLeads && reputation >= lead.repRequired}
                    onAccept={() => acceptLead(lead.id)}
                    onReject={() => dispatchAt((at) => rejectLeadMsg(at, lead.id))}
                  />
                )}
                {!project && !lead && !tutorialDone && (
                  <p className="empty-slot" aria-label="Finish your first project to unlock leads.">
                    Finish your first project to unlock leads.
                  </p>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}
