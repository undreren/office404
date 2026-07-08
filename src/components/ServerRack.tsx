import { MODELS } from '../game/models'
import { useGameStore } from '../game/store'
import { EXTINGUISH_COST } from '../game/constants'

export function ServerRack() {
  const servers = useGameStore((s) => s.servers)
  const agents = useGameStore((s) => s.agents)
  const projects = useGameStore((s) => s.projects)
  const cash = useGameStore((s) => s.cash)
  const restartAgent = useGameStore((s) => s.restartAgent)
  const unassignAgent = useGameStore((s) => s.unassignAgent)
  const extinguishFire = useGameStore((s) => s.extinguishFire)

  function taskLabel(taskId: string | null): string {
    if (!taskId) return 'Idle'
    for (const p of projects) {
      const t = p.tasks.find((x) => x.id === taskId)
      if (t) return t.title
    }
    return 'Unknown task'
  }

  return (
    <section className="panel server-rack">
      <h2>Server Farm</h2>

      {servers.map((server) => {
        const serverAgents = agents.filter((a) => a.serverId === server.id)

        return (
          <article key={server.id} className={`rack ${server.onFire ? 'rack--fire' : ''}`}>
            <header className="rack__header">
              <h3>{server.name}</h3>
              <span>
                {serverAgents.length}/{server.capacity} agents
                {server.onFire && <em className="fire-badge"> ON FIRE</em>}
              </span>
            </header>

            {server.onFire && (
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => extinguishFire(server.id)}
                disabled={cash < EXTINGUISH_COST}
              >
                Extinguish (${EXTINGUISH_COST})
              </button>
            )}

            <div className="agent-grid">
              {serverAgents.length === 0 && (
                <p className="empty-slot">Empty rack. Install or deploy an agent.</p>
              )}
              {serverAgents.map((agent) => {
                const model = MODELS[agent.modelId]
                const contextPct = model ? (agent.contextUsed / model.contextSize) * 100 : 0

                return (
                  <div key={agent.id} className={`agent-card agent-card--${agent.status}`}>
                    <div className="agent-card__header">
                      <strong>{agent.name}</strong>
                      <span className="agent-status">{agent.status}</span>
                    </div>
                    <p className="agent-vendor">{model?.name ?? agent.modelId}</p>
                    <p className="agent-personality">{agent.personality}</p>
                    <p className="agent-meta">Task: {taskLabel(agent.taskId)}</p>
                    {agent.status !== 'idle' && model && (
                      <div className="meter-row">
                        <label>Context</label>
                        <div className="meter meter--sm">
                          <div
                            className={`meter__fill ${contextPct > 80 ? 'meter__fill--critical' : 'meter__fill--tokens'}`}
                            style={{ width: `${Math.min(100, contextPct)}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {agent.status === 'warming' && (
                      <p className="agent-meta">Warming up… {agent.warmupRemaining.toFixed(1)}d</p>
                    )}
                    {agent.status === 'compacted' && (
                      <button type="button" className="btn btn--small" onClick={() => restartAgent(agent.id)}>
                        Restart
                      </button>
                    )}
                    {agent.taskId && (
                      <button type="button" className="btn btn--small btn--danger" onClick={() => unassignAgent(agent.id)}>
                        Yank
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </article>
        )
      })}
    </section>
  )
}
