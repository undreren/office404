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
import { assignAutomationAgentMsg, setAutomationAgentActiveMsg } from '../game/messages'
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
  onAutomationToggle,
}: {
  agent: Agent
  duty: string
  fill: number
  isCompacting: boolean
  onAutomationToggle?: (active: boolean) => void
}) {
  const isAutomation = agent.isAutomation && agent.automationJob
  const automationActive = isAutomation && agent.job === agent.automationJob
  const automationJob = agent.automationJob

  const agentSummary = [
    agent.name,
    duty,
    isAutomation ? null : `${Math.floor(fill)}% context`,
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
      {!isAutomation && (
        <span
          className={`agent-mini-card__ctx${isCompacting ? ' agent-mini-card__ctx--draining' : ''}`}
        >
          {Math.floor(fill)}% ctx
        </span>
      )}
      {isAutomation && automationJob && onAutomationToggle && (
        <button
          type="button"
          className="btn btn--small agent-mini-card__bench"
          data-testid={
            automationActive
              ? `status-bench-automation-${automationJob}`
              : `status-activate-automation-${automationJob}`
          }
          aria-label={
            automationActive
              ? `Bench ${agentRoleLabel(automationJob)} agent ${agent.name}`
              : `Activate ${agentRoleLabel(automationJob)} agent ${agent.name}`
          }
          onClick={() => onAutomationToggle(!automationActive)}
        >
          {automationActive ? 'Bench' : 'Activate'}
        </button>
      )}
    </li>
  )
}

function SpecialistRoleRow({
  job,
  rosterFull,
  onAssign,
}: {
  job: AutomationAgentJob
  rosterFull: boolean
  onAssign: () => void
}) {
  const label = agentRoleLabel(job)
  return (
    <li
      className="agent-mini-card agent-mini-card--unassigned"
      aria-label={`${label} specialist unassigned${rosterFull ? ', roster full' : ''}`}
    >
      <span className="agent-mini-card__name">{label}</span>
      <span className="agent-mini-card__duty">Unassigned — uses one roster slot</span>
      <button
        type="button"
        className="btn btn--small agent-mini-card__bench"
        data-testid={`status-assign-automation-${job}`}
        aria-label={`Assign ${label} specialist${rosterFull ? ', roster full' : ''}`}
        disabled={rosterFull}
        onClick={onAssign}
      >
        Assign
      </button>
    </li>
  )
}

export function StatusPanel() {
  const state = useGameState()
  const { agents, projects, meta, events, vibingCourses } = state
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
          <h3 className="status-panel__section">Specialist agents</h3>
          <p className="hint">
            Prestige unlocks and vibing courses. Each specialist uses a roster slot ({agents.length}/
            {rosterMax}).
          </p>
          <div className="status-panel__specialist-box">
            <ul className="agent-mini-list">
              {specialistJobs.map((job) => {
                const agent = agents.find((a) => a.isAutomation && a.automationJob === job)
                if (!agent) {
                  return (
                    <SpecialistRoleRow
                      key={job}
                      job={job}
                      rosterFull={rosterFull}
                      onAssign={() =>
                        dispatchAt((at) => assignAutomationAgentMsg(at, job))
                      }
                    />
                  )
                }

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
                    onAutomationToggle={(active) =>
                      dispatchAt((at) => setAutomationAgentActiveMsg(at, agent.id, active))
                    }
                  />
                )
              })}
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
