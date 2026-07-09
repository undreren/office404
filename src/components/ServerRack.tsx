import { getModel } from '../game/models'
import { useGameStore } from '../game/store'
import { EXTINGUISH_COST, RACK_REFURBISH_VALUE } from '../game/constants'
import type { Task } from '../game/types'

export function ServerRack() {
  const servers = useGameStore((s) => s.servers)
  const agents = useGameStore((s) => s.agents)
  const projects = useGameStore((s) => s.projects)
  const cash = useGameStore((s) => s.cash)
  const restartAgent = useGameStore((s) => s.restartAgent)
  const unassignAgent = useGameStore((s) => s.unassignAgent)
  const offloadAgent = useGameStore((s) => s.offloadAgent)
  const extinguishFire = useGameStore((s) => s.extinguishFire)
  const sellServer = useGameStore((s) => s.sellServer)

  function findTask(taskId: string | null): Task | null {
    if (!taskId) return null
    for (const p of projects) {
      const t = p.tasks.find((x) => x.id === taskId)
      if (t) return t
    }
    return null
  }

  function taskLabel(taskId: string | null): string {
    const task = findTask(taskId)
    return task?.title ?? (taskId ? 'Unknown task' : 'Idle')
  }

  return (
    <section className="panel server-rack">
      <h2>Server Farm</h2>

      {servers.length === 0 && (
        <p className="empty-slot">No racks yet. Buy one from the Marketplace to deploy models.</p>
      )}

      {servers.map((server) => {
        const serverAgents = agents.filter(
          (a) => a.serverId === server.id && getModel(a.modelId)?.kind === 'local',
        )
        const gpuShare = serverAgents.length > 1 ? `GPU ÷${serverAgents.length}` : 'GPU ×1'

        return (
          <article key={server.id} className={`rack ${server.onFire ? 'rack--fire' : ''}`}>
            <header className="rack__header">
              <h3>{server.name}</h3>
              <span>
                {serverAgents.length} loaded · {gpuShare}
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

            {serverAgents.length === 0 && !server.onFire && (
              <button
                type="button"
                className="btn btn--small"
                onClick={() => sellServer(server.id)}
              >
                Sell (${RACK_REFURBISH_VALUE[server.tier] ?? 0})
              </button>
            )}

            <div className="agent-grid">
              {serverAgents.length === 0 && (
                <p className="empty-slot">Empty rack. Install a local model — RAM permitting.</p>
              )}
              {serverAgents.map((agent) => {
                const model = getModel(agent.modelId)
                const contextPct = model ? (agent.contextUsed / model.contextSize) * 100 : 0
                const task = findTask(agent.taskId)
                const taskPct = task
                  ? (task.storyPointsEarned / task.storyPointsRequired) * 100
                  : 0

                return (
                  <div key={agent.id} className={`agent-card agent-card--${agent.status}`}>
                    <div className="agent-card__header">
                      <strong>{agent.name}</strong>
                      <span className="agent-status">{agent.status}</span>
                    </div>
                    <p className="agent-vendor">{model?.name ?? agent.modelId}</p>
                    <p className="agent-personality">{agent.personality}</p>
                    <p className="agent-meta">Task: {taskLabel(agent.taskId)}</p>

                    {task && agent.status === 'working' && (
                      <div className="meter-row">
                        <label>Ticket progress</label>
                        <div className="meter meter--sm">
                          <div
                            className="meter__fill meter__fill--code"
                            style={{ width: `${Math.min(100, taskPct)}%` }}
                          />
                        </div>
                        <span className="task-sp">
                          {task.storyPointsEarned.toFixed(1)} / {task.storyPointsRequired} SP
                        </span>
                      </div>
                    )}

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
                    {!agent.taskId && (
                      <button type="button" className="btn btn--small" onClick={() => offloadAgent(agent.id)}>
                        Offload
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
