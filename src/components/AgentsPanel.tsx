import { agentContextDisplayPct, formatAgentDutyLabel } from '../game/mechanics'
import { MODEL_TIERS } from '../game/models'
import type { Task } from '../game/types'
import { useGameState } from '../runtime/GameRuntime'

export function AgentsPanel() {
  const { agents, projects, modelTierIndex } = useGameState()
  const model = MODEL_TIERS[modelTierIndex]

  function findTask(taskId: string | null): Task | null {
    if (!taskId) return null
    for (const p of projects) {
      const t = p.tasks.find((x) => x.id === taskId)
      if (t) return t
    }
    return null
  }

  if (agents.length === 0) {
    return (
      <section className="panel agents-panel">
        <h2>Agents</h2>
        <p className="panel__subtitle">Synthetic coworkers who never ask about your weekend.</p>
        <p className="hint">No agents deployed. Staff a project with + to spawn.</p>
      </section>
    )
  }

  return (
    <section className="panel agents-panel">
      <h2>Agents ({agents.length})</h2>
      <p className="panel__subtitle">Synthetic coworkers who never ask about your weekend.</p>
      <p className="hint">
        All running {model.displayName} · spawn on assign, bench on unassign (context preserved)
      </p>
      <ul className="agent-mini-list">
        {agents.map((agent) => {
          const project = projects.find((p) => p.id === agent.projectId)
          const task = findTask(agent.taskId)
          const fill = agentContextDisplayPct(agent, model.contextSize)
          const duty = formatAgentDutyLabel(agent, project?.clientName, task?.title)
          const isCompacting = agent.status === 'compacting'

          return (
            <li
              key={agent.id}
              className={`agent-mini-card${isCompacting ? ' agent-mini-card--compacting' : ''}`}
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
    </section>
  )
}
