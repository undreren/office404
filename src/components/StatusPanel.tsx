import {
  agentContextDisplayPct,
  agentRoleLabel,
  countAssignedPmAgents,
  formatAgentDutyLabel,
  formatPercent,
  maxAgents,
  maxAssignablePmAgents,
  unlockedAutomationJobs,
  type AutomationAgentJob,
} from '../game/mechanics'
import { getHallucinationLevel } from '../game/meta'
import { MODEL_TIERS, contextSizeForLevel } from '../game/models'
import type { Agent, Project, Task } from '../game/types'
import { toggleSpecialistRoleMsg } from '../game/messages'
import { useGameDispatchAt, useGameState } from '../runtime/GameRuntime'
import { SaveBackupPanel } from './SaveBackupPanel'

const EVENT_ICONS: Record<string, string> = {
  crash: '💥',
  fire: '🔥',
  client: '📧',
  token: '🪙',
  milestone: '🚀',
  system: '⚙️',
  project: '📋',
  lead: '📨',
}

function findTask(projects: Project[], taskId: string | null): Task | null {
  if (!taskId) return null
  for (const p of projects) {
    const t = p.tasks.find((x) => x.id === taskId)
    if (t) return t
  }
  return null
}

function AgentMiniCard({
  agent,
  duty,
  fill,
  isCompacting,
}: {
  agent: Agent
  duty: string
  fill: number
  isCompacting: boolean
}) {
  const agentSummary = [
    agent.name,
    duty,
    `${formatPercent(fill)}% context`,
    isCompacting ? 'compacting' : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <li
      className={`agent-mini-card${isCompacting ? ' agent-mini-card--compacting' : ''}`}
      aria-label={agentSummary}
    >
      <span className="agent-mini-card__name">{agent.name}</span>
      <span className="agent-mini-card__duty">{duty}</span>
      <span
        className={`agent-mini-card__ctx${isCompacting ? ' agent-mini-card__ctx--draining' : ''}`}
      >
        {formatPercent(fill)}% ctx
      </span>
    </li>
  )
}

function PmSpecialistRoleRow({
  assignedCount,
  maxAssignable,
  rosterFull,
  canYeetForSlot,
  agents,
  modelContextSize,
  projects,
  onAdjust,
}: {
  assignedCount: number
  maxAssignable: number
  rosterFull: boolean
  canYeetForSlot: boolean
  agents: Agent[]
  modelContextSize: number
  projects: Project[]
  onAdjust: (enabled: boolean) => void
}) {
  const label = agentRoleLabel('project_manager')
  const disableAssign = assignedCount >= maxAssignable || (rosterFull && !canYeetForSlot)
  const pmAgents = agents.filter((a) => a.isAutomation && a.automationJob === 'project_manager')

  return (
    <li className="specialist-role-row">
      <div className="crew-label specialist-role-row__label specialist-role-row__label--pm">
        <span>{label}</span>
        <span className="specialist-role-row__pm-controls">
          <button
            type="button"
            className="btn btn--ghost btn--tiny"
            disabled={assignedCount <= 0}
            data-testid="status-specialist-project_manager-remove"
            aria-label={`Unassign one ${label}`}
            onClick={() => onAdjust(false)}
          >
            −
          </button>
          <span
            className="specialist-role-row__pm-count"
            data-testid="status-specialist-project_manager-count"
            aria-label={`${assignedCount} of ${maxAssignable} ${label} specialists assigned`}
          >
            {assignedCount}/{maxAssignable}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--tiny"
            disabled={disableAssign}
            data-testid="status-specialist-project_manager-add"
            aria-label={`Assign one ${label}${disableAssign ? ', roster full or cap reached' : ''}`}
            onClick={() => onAdjust(true)}
          >
            +
          </button>
        </span>
        <span className="hint">(+1 client gig each)</span>
      </div>
      {pmAgents.length > 0 && (
        <ul className="agent-mini-list agent-mini-list--inline">
          {pmAgents.map((agent) => (
            <AgentMiniCard
              key={agent.id}
              agent={agent}
              duty={formatAgentDutyLabel(
                agent,
                projects.find((p) => p.id === agent.projectId)?.clientName,
                findTask(projects, agent.taskId)?.title,
              )}
              fill={agentContextDisplayPct(agent, modelContextSize)}
              isCompacting={agent.status === 'compacting'}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function SpecialistRoleRow({
  job,
  assigned,
  rosterFull,
  canYeetForSlot,
  agent,
  modelContextSize,
  projects,
  onToggle,
}: {
  job: AutomationAgentJob
  assigned: boolean
  rosterFull: boolean
  canYeetForSlot: boolean
  agent: Agent | undefined
  modelContextSize: number
  projects: Project[]
  onToggle: (enabled: boolean) => void
}) {
  const label = agentRoleLabel(job)
  const disableAssign = !assigned && rosterFull && !canYeetForSlot
  const autoManaged = job === 'offline'

  return (
    <li className="specialist-role-row">
      {autoManaged ? (
        <span className="crew-label specialist-role-row__label">
          {label}{' '}
          <span className="hint">(auto while away)</span>
        </span>
      ) : (
        <label className="crew-label specialist-role-row__label">
          <input
            type="checkbox"
            checked={assigned}
            disabled={disableAssign}
            data-testid={`status-specialist-${job}`}
            aria-label={`${label} specialist${assigned ? ', assigned' : disableAssign ? ', roster full' : ', unassigned'}`}
            onChange={(e) => onToggle(e.target.checked)}
          />{' '}
          {label}
        </label>
      )}
      {agent && (
        <ul className="agent-mini-list agent-mini-list--inline">
          <AgentMiniCard
            agent={agent}
            duty={formatAgentDutyLabel(
              agent,
              projects.find((p) => p.id === agent.projectId)?.clientName,
              findTask(projects, agent.taskId)?.title,
            )}
            fill={agentContextDisplayPct(agent, modelContextSize)}
            isCompacting={agent.status === 'compacting'}
          />
        </ul>
      )}
    </li>
  )
}

export function StatusPanel() {
  const state = useGameState()
  const { agents, projects, meta, events, vibingCourses, vibingCourseTiers, assignedSpecialistRoles } = state
  const dispatchAt = useGameDispatchAt()
  const modelLevel = getHallucinationLevel(meta, 'model')
  const model = MODEL_TIERS[Math.min(modelLevel, MODEL_TIERS.length - 1)]!
  const contextSizeK = contextSizeForLevel(model.contextSize, getHallucinationLevel(meta, 'context'))

  const specialistJobs = unlockedAutomationJobs({ vibingCourses, meta })
  const regularAgents = agents.filter((agent) => !agent.isAutomation)
  const rosterMax = maxAgents(state)
  const rosterFull = agents.length >= rosterMax
  const canYeetForSlot = agents.some((a) => !a.isAutomation && a.projectId && a.job)

  return (
    <section className="panel status-panel">
      <h2>Status</h2>
      <p className="panel__subtitle">Agents on the roster and incidents in the log.</p>

      {specialistJobs.length > 0 && (
        <>
          <h3 className="status-panel__section">Specialist roles</h3>
          <p className="hint">
            Toggle to assign an agent to each role (Project Managers: one per extra client gig). Unassigned
            roles use no roster slot ({agents.length}/{rosterMax}).
          </p>
          <div className="status-panel__specialist-box">
            <ul className="specialist-role-list">
              {specialistJobs.map((job) =>
                job === 'project_manager' ? (
                  <PmSpecialistRoleRow
                    key={job}
                    assignedCount={countAssignedPmAgents(agents)}
                    maxAssignable={maxAssignablePmAgents({ vibingCourses, vibingCourseTiers, meta })}
                    rosterFull={rosterFull}
                    canYeetForSlot={canYeetForSlot}
                    agents={agents}
                    modelContextSize={contextSizeK}
                    projects={projects}
                    onAdjust={(enabled) =>
                      dispatchAt((at) => toggleSpecialistRoleMsg(at, job, enabled))
                    }
                  />
                ) : (
                  <SpecialistRoleRow
                    key={job}
                    job={job}
                    assigned={assignedSpecialistRoles.includes(job)}
                    rosterFull={rosterFull}
                    canYeetForSlot={canYeetForSlot}
                    agent={agents.find((a) => a.isAutomation && a.automationJob === job)}
                    modelContextSize={contextSizeK}
                    projects={projects}
                    onToggle={(enabled) =>
                      dispatchAt((at) => toggleSpecialistRoleMsg(at, job, enabled))
                    }
                  />
                ),
              )}
            </ul>
          </div>
        </>
      )}

      <h3 className="status-panel__section">Agents</h3>
      {regularAgents.length === 0 ? (
        <p className="hint" aria-label="No project agents deployed. Staff a project with plus to spawn.">
          No project agents deployed. Staff a project with + to spawn.
        </p>
      ) : (
        <>
          <p
            className="hint"
            aria-label={`All agents running ${model.displayName}. Spawn on assign, bench on unassign with context preserved.`}
          >
            All running {model.displayName} · spawn on assign, bench on unassign (context preserved)
          </p>
          <ul className="agent-mini-list">
            {regularAgents.map((agent) => {
              const project = projects.find((p) => p.id === agent.projectId)
              const task = findTask(projects, agent.taskId)
              const fill = agentContextDisplayPct(agent, contextSizeK)
              const duty = formatAgentDutyLabel(agent, project?.clientName, task?.title)
              const isCompacting = agent.status === 'compacting'

              return (
                <AgentMiniCard
                  key={agent.id}
                  agent={agent}
                  duty={duty}
                  fill={fill}
                  isCompacting={isCompacting}
                />
              )
            })}
          </ul>
        </>
      )}

      <SaveBackupPanel />

      <h3 className="status-panel__section">Incident log</h3>
      <p className="hint">Where productivity goes to file a missing persons report.</p>
      <ul className="event-list event-list--feed">
        {events.map((event) => (
          <li
            key={event.id}
            className={`event event--${event.type}`}
            aria-label={`${event.type}: ${event.message}`}
          >
            <span className="event__icon">{EVENT_ICONS[event.type] ?? '•'}</span>
            <span className="event__message">{event.message}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
