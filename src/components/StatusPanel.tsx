import {
  agentContextDisplayPct,
  agentRoleLabel,
  formatAgentDutyLabel,
  maxAgents,
  unlockedAutomationJobs,
  type AutomationAgentJob,
} from '../game/mechanics'
import { getHallucinationLevel } from '../game/meta'
import { MODEL_TIERS } from '../game/models'
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
    `${Math.floor(fill)}% context`,
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
        {Math.floor(fill)}% ctx
      </span>
    </li>
  )
}

function SpecialistRoleRow({
  job,
  assigned,
  rosterFull,
  agent,
  modelContextSize,
  projects,
  onToggle,
}: {
  job: AutomationAgentJob
  assigned: boolean
  rosterFull: boolean
  agent: Agent | undefined
  modelContextSize: number
  projects: Project[]
  onToggle: (enabled: boolean) => void
}) {
  const label = agentRoleLabel(job)
  const disableAssign = !assigned && rosterFull
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
  const { agents, projects, meta, events, vibingCourses, assignedSpecialistRoles } = state
  const dispatchAt = useGameDispatchAt()
  const modelLevel = getHallucinationLevel(meta, 'model')
  const model = MODEL_TIERS[Math.min(modelLevel, MODEL_TIERS.length - 1)]!

  const specialistJobs = unlockedAutomationJobs({ vibingCourses, meta })
  const regularAgents = agents.filter((agent) => !agent.isAutomation)
  const rosterMax = maxAgents(state)
  const rosterFull = agents.length >= rosterMax

  return (
    <section className="panel status-panel">
      <h2>Status</h2>
      <p className="panel__subtitle">Agents on the roster and incidents in the log.</p>

      {specialistJobs.length > 0 && (
        <>
          <h3 className="status-panel__section">Specialist roles</h3>
          <p className="hint">
            Toggle to assign an agent to each role. Unassigned roles use no roster slot (
            {agents.length}/{rosterMax}).
          </p>
          <div className="status-panel__specialist-box">
            <ul className="specialist-role-list">
              {specialistJobs.map((job) => (
                <SpecialistRoleRow
                  key={job}
                  job={job}
                  assigned={assignedSpecialistRoles.includes(job)}
                  rosterFull={rosterFull}
                  agent={agents.find((a) => a.isAutomation && a.automationJob === job)}
                  modelContextSize={model.contextSize}
                  projects={projects}
                  onToggle={(enabled) =>
                    dispatchAt((at) => toggleSpecialistRoleMsg(at, job, enabled))
                  }
                />
              ))}
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
              const fill = agentContextDisplayPct(agent, model.contextSize)
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
