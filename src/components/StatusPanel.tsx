import { agentContextDisplayPct, formatAgentDutyLabel } from '../game/mechanics'
import { getHallucinationLevel } from '../game/meta'
import { MODEL_TIERS } from '../game/models'
import type { Task } from '../game/types'
import { useGameState } from '../runtime/GameRuntime'
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

export function StatusPanel() {
  const { agents, projects, meta, events } = useGameState()
  const modelLevel = getHallucinationLevel(meta, 'model')
  const model = MODEL_TIERS[Math.min(modelLevel, MODEL_TIERS.length - 1)]!

  function findTask(taskId: string | null): Task | null {
    if (!taskId) return null
    for (const p of projects) {
      const t = p.tasks.find((x) => x.id === taskId)
      if (t) return t
    }
    return null
  }

  return (
    <section className="panel status-panel">
      <h2>Status</h2>
      <p className="panel__subtitle">Agents on the roster and incidents in the log.</p>

      <h3 className="status-panel__section">Agents</h3>
      {agents.length === 0 ? (
        <p className="hint" aria-label="No agents deployed. Staff a project with plus to spawn.">
          No agents deployed. Staff a project with + to spawn.
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
            {agents.map((agent) => {
              const project = projects.find((p) => p.id === agent.projectId)
              const task = findTask(agent.taskId)
              const fill = agentContextDisplayPct(agent, model.contextSize)
              const duty = formatAgentDutyLabel(agent, project?.clientName, task?.title)
              const isCompacting = agent.status === 'compacting'

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
                  key={agent.id}
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
