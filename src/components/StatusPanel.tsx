import {
  agentContextDisplayPct,
  agentContextTokenCapacity,
  agentRoleLabel,
  formatAgentDutyLabel,
  formatPercent,
  unlockedAutomationJobs,
  type AutomationAgentJob,
} from '../game/mechanics'
import { getHallucinationLevel } from '../game/meta'
import { MODEL_TIERS } from '../game/models'
import type { Agent, Project, Task } from '../game/types'
import { setContextRamLevelMsg, toggleSpecialistRoleMsg } from '../game/messages'
import { agentCapacity } from '../game/selectors'
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

function SpecialistRoleRow({
  job,
  assigned,
  rosterFull,
  canYeetForSlot,
  agent,
  contextTokens,
  projects,
  onToggle,
}: {
  job: AutomationAgentJob
  assigned: boolean
  rosterFull: boolean
  canYeetForSlot: boolean
  agent: Agent | undefined
  contextTokens: number
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
            fill={agentContextDisplayPct(agent, contextTokens)}
            isCompacting={agent.status === 'compacting'}
          />
        </ul>
      )}
    </li>
  )
}

export function StatusPanel() {
  const state = useGameState()
  const { agents, projects, meta, events, vibingCourses, assignedSpecialistRoles, contextRamLevel } =
    state
  const dispatchAt = useGameDispatchAt()
  const modelLevel = getHallucinationLevel(meta, 'model')
  const model = MODEL_TIERS[Math.min(modelLevel, MODEL_TIERS.length - 1)]!
  const prestigeContext = getHallucinationLevel(meta, 'context')
  const contextTokens = agentContextTokenCapacity(contextRamLevel ?? 0, prestigeContext)

  const specialistJobs = unlockedAutomationJobs({ vibingCourses, meta })
  const regularAgents = agents.filter((agent) => !agent.isAutomation)
  const { used: rosterUsed, max: rosterMax, usedRamGb, agentSlots: totalRamGb } = agentCapacity(state)
  const rosterFull = rosterUsed >= rosterMax
  const canYeetForSlot = agents.some((a) => !a.isAutomation && a.projectId && a.job)

  const maxContextRamLevel =
    agents.length > 0
      ? Math.max(0, Math.floor((totalRamGb - usedRamGb + (contextRamLevel ?? 0) * agents.length) / agents.length))
      : 0

  return (
    <section className="panel status-panel">
      <h2>Status</h2>
      <p className="panel__subtitle">Agents on the roster and incidents in the log.</p>

      <h3 className="status-panel__section">Context RAM</h3>
      <p className="hint">
        +{contextRamLevel ?? 0} GB per agent → {contextTokens.toLocaleString()} token window. Trades roster RAM for
        context headroom.
      </p>
      <div className="status-panel__context-ram">
        <label className="crew-label" htmlFor="context-ram-slider">
          Context RAM: +{contextRamLevel ?? 0} GB/agent
        </label>
        <input
          id="context-ram-slider"
          type="range"
          min={0}
          max={maxContextRamLevel}
          value={contextRamLevel ?? 0}
          data-testid="status-context-ram-slider"
          aria-label={`Context RAM level ${contextRamLevel ?? 0} of ${maxContextRamLevel}`}
          onChange={(e) =>
            dispatchAt((at) => setContextRamLevelMsg(at, Number(e.target.value)))
          }
        />
        <span className="hint">
          {usedRamGb}/{totalRamGb} GB used · {rosterUsed}/{rosterMax} agents
        </span>
      </div>

      {specialistJobs.length > 0 && (
        <>
          <h3 className="status-panel__section">Specialist roles</h3>
          <p className="hint">
            Toggle to assign an agent to each role. PM auto-delivers and staffs conductors on new gigs. Unassigned
            roles use no roster slot ({rosterUsed}/{rosterMax}).
          </p>
          <div className="status-panel__specialist-box">
            <ul className="specialist-role-list">
              {specialistJobs.map((job) => (
                <SpecialistRoleRow
                  key={job}
                  job={job}
                  assigned={assignedSpecialistRoles.includes(job)}
                  rosterFull={rosterFull}
                  canYeetForSlot={canYeetForSlot}
                  agent={agents.find((a) => a.isAutomation && a.automationJob === job)}
                  contextTokens={contextTokens}
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
              const fill = agentContextDisplayPct(agent, contextTokens)
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
