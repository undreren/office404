import { VENDORS } from '../game/vendors'
import { useGameStore } from '../game/store'
import { REBOOT_COST, EXTINGUISH_COST } from '../game/constants'

export function ServerRack() {
  const servers = useGameStore((s) => s.servers)
  const agents = useGameStore((s) => s.agents)
  const credits = useGameStore((s) => s.credits)
  const rebootAgent = useGameStore((s) => s.rebootAgent)
  const extinguishFire = useGameStore((s) => s.extinguishFire)

  return (
    <section className="panel server-rack">
      <h2>Server Farm</h2>

      {servers.map((server) => {
        const serverAgents = agents.filter((a) => a.serverId === server.id)
        const activeCount = serverAgents.filter((a) => a.status !== 'crashed').length

        return (
          <article key={server.id} className={`rack ${server.onFire ? 'rack--fire' : ''}`}>
            <header className="rack__header">
              <h3>{server.name}</h3>
              <span>
                {activeCount}/{server.capacity} agents
                {server.onFire && <em className="fire-badge"> ON FIRE</em>}
              </span>
            </header>

            {server.onFire && (
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => extinguishFire(server.id)}
                disabled={credits < EXTINGUISH_COST}
              >
                Extinguish (${EXTINGUISH_COST})
              </button>
            )}

            <div className="agent-grid">
              {serverAgents.length === 0 && (
                <p className="empty-slot">Empty rack. Deploy an agent to begin the chaos.</p>
              )}
              {serverAgents.map((agent) => {
                const vendor = VENDORS[agent.vendorId]
                return (
                  <div key={agent.id} className={`agent-card agent-card--${agent.status}`}>
                    <div className="agent-card__header">
                      <strong>{agent.name}</strong>
                      <span className="agent-status">{agent.status}</span>
                    </div>
                    <p className="agent-vendor">{vendor.name}</p>
                    <p className="agent-personality">{agent.personality}</p>
                    <p className="agent-meta">
                      Uptime: {Math.floor(agent.uptime)}s · Burned: {Math.floor(agent.totalTokensBurned)} tok
                    </p>
                    {agent.status === 'crashed' && (
                      <button
                        type="button"
                        className="btn btn--small"
                        onClick={() => rebootAgent(agent.id)}
                        disabled={credits < REBOOT_COST}
                      >
                        Reboot (${REBOOT_COST})
                      </button>
                    )}
                    {agent.status === 'rebooting' && (
                      <div className="meter meter--sm">
                        <div
                          className="meter__fill meter__fill--code"
                          style={{ width: `${(agent.rebootProgress / 8) * 100}%` }}
                        />
                      </div>
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
