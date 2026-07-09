import { syncTestScope } from '../game/projects'
import { RACK_CONFIG, EXTINGUISH_COST, RACK_REFURBISH_VALUE } from '../game/constants'
import { getModel } from '../game/models'
import {
  contextFillPct,
  effectiveSuccessRate,
  formatStoryPoints,
  formatSuccessPct,
  getHostGpus,
  LAPTOP_HOST_ID,
} from '../game/mechanics'
import { useGameStore } from '../game/store'
import type { LoadedModel, Task } from '../game/types'

function HostRack({
  hostId,
  title,
  gpus,
  ram,
  onFire,
  serverId,
}: {
  hostId: string
  title: string
  gpus: number
  ram: number
  onFire?: boolean
  serverId?: string
}) {
  const agents = useGameStore((s) => s.agents)
  const loadedModels = useGameStore((s) => s.loadedModels)
  const projects = useGameStore((s) => s.projects)
  const cash = useGameStore((s) => s.cash)
  const servers = useGameStore((s) => s.servers)
  const restartAgent = useGameStore((s) => s.restartAgent)
  const unassignAgent = useGameStore((s) => s.unassignAgent)
  const offloadAgent = useGameStore((s) => s.offloadAgent)
  const extinguishFire = useGameStore((s) => s.extinguishFire)
  const sellServer = useGameStore((s) => s.sellServer)
  const unloadModel = useGameStore((s) => s.unloadModel)

  const hostAgents = agents.filter((a) => a.serverId === hostId && getModel(a.modelId)?.kind === 'local')
  const hostLoads = loadedModels.filter((lm) => lm.hostId === hostId)
  const workingCount = hostAgents.filter((a) => a.job).length
  const gpuShare = workingCount > 0 ? `GPU ×${gpus} ÷${workingCount}` : `GPU ×${gpus}`

  function findTask(taskId: string | null): Task | null {
    if (!taskId) return null
    for (const p of projects) {
      const t = p.tasks.find((x) => x.id === taskId)
      if (t) return t
    }
    return null
  }

  function dutyLabel(agent: (typeof agents)[number]): string {
    if (!agent.job) return 'Idle'
    const project = projects.find((p) => p.id === agent.projectId)
    const client = project?.clientName ?? 'project'
    if (agent.job === 'refactor') return `Refactoring: ${client}`
    if (agent.job === 'refine') return `Refining scope: ${client}`
    if (agent.job === 'review') return `Reviewing PRs: ${client}`
    if (agent.job === 'test') return `Testing delivery: ${client}`
    const task = findTask(agent.taskId)
    return `Coding: ${task?.title ?? client}`
  }

  function renderLoadedModel(lm: LoadedModel) {
    const model = getModel(lm.modelId)
    if (!model) return null
    const modelAgents = hostAgents.filter((a) => a.loadedModelId === lm.id)
    const canUnload = modelAgents.length === 0

    return (
      <div key={lm.id} className="loaded-model">
        <header className="loaded-model__header">
          <strong>{model.name}</strong>
          <span>{modelAgents.length} worker(s)</span>
        </header>
        {canUnload && (
          <button type="button" className="btn btn--small" onClick={() => unloadModel(lm.id)}>
            Unload
          </button>
        )}
        <div className="agent-grid">
          {modelAgents.map((agent) => {
            const task = findTask(agent.taskId)
            const fillPct = contextFillPct(agent.contextUsed, model.contextSize)
            const taskSp = task?.storyPointsRequired ?? 1
            const success = effectiveSuccessRate(model.parameters, taskSp, fillPct)
            const taskPct = task ? (task.storyPointsEarned / task.storyPointsRequired) * 100 : 0

            return (
              <div key={agent.id} className={`agent-card agent-card--${agent.status}`}>
                <div className="agent-card__header">
                  <strong>{agent.name}</strong>
                  <span className="agent-status">{agent.status}</span>
                </div>
                <p className="agent-personality">{agent.personality}</p>
                <p className="agent-meta">{dutyLabel(agent)}</p>
                {agent.job === 'code' && (
                  <p className="agent-meta">
                    Success: {formatSuccessPct(success)}
                    {task ? ` (${taskSp} SP)` : ' (1 SP idle)'}
                  </p>
                )}

                {task && agent.job === 'code' && (
                  <div className="meter-row">
                    <label>Ticket progress</label>
                    <div className="meter meter--sm">
                      <div
                        className="meter__fill meter__fill--code"
                        style={{ width: `${Math.min(100, taskPct)}%` }}
                      />
                    </div>
                    <span className="task-sp">
                      {formatStoryPoints(task.storyPointsEarned)} / {formatStoryPoints(task.storyPointsRequired)} SP
                    </span>
                  </div>
                )}

                {(agent.job === 'review' || agent.job === 'refine') &&
                  agent.jobDuration > 0 && (
                  <div className="meter-row">
                    <label>
                      {agent.job === 'review' ? 'Review' : 'Refine'} progress
                    </label>
                    <div className="meter meter--sm">
                      <div
                        className="meter__fill meter__fill--code"
                        style={{ width: `${Math.min(100, (agent.jobProgress / agent.jobDuration) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {agent.job === 'test' && agent.projectId && (() => {
                  const project = projects.find((p) => p.id === agent.projectId)
                  if (!project) return null
                  const synced = syncTestScope(project)
                  return (
                    <div className="meter-row">
                      <label>QA progress</label>
                      <div className="meter meter--sm">
                        <div
                          className="meter__fill meter__fill--sanity"
                          style={{ width: `${Math.min(100, synced.testPercent)}%` }}
                        />
                      </div>
                      <span className="task-sp">{Math.floor(synced.testPercent)}%</span>
                    </div>
                  )
                })()}

                {agent.job && agent.status !== 'compacted' && (
                  <div className="meter-row">
                    <label>Context</label>
                    <div className="meter meter--sm">
                      <div
                        className={`meter__fill meter__fill--tokens ${fillPct > 80 ? 'meter__fill--critical' : ''}`}
                        style={{ width: `${Math.min(100, fillPct)}%` }}
                      />
                    </div>
                  </div>
                )}

                {agent.status === 'compacted' && (
                  <button type="button" className="btn btn--small" onClick={() => restartAgent(agent.id)}>
                    Restart
                  </button>
                )}
                {agent.job && (
                  <button type="button" className="btn btn--small btn--danger" onClick={() => unassignAgent(agent.id)}>
                    Yank
                  </button>
                )}
                {!agent.job && (
                  <button type="button" className="btn btn--small" onClick={() => offloadAgent(agent.id)}>
                    Offload
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <article className={`rack ${onFire ? 'rack--fire' : ''}`}>
      <header className="rack__header">
        <h3>{title}</h3>
        <span>
          {ram} GB · {gpuShare}
          {onFire && <em className="fire-badge"> ON FIRE</em>}
        </span>
      </header>

      {onFire && serverId && (
        <button
          type="button"
          className="btn btn--danger"
          onClick={() => extinguishFire(serverId)}
          disabled={cash < EXTINGUISH_COST}
        >
          Extinguish (${EXTINGUISH_COST})
        </button>
      )}

      {serverId && hostAgents.length === 0 && hostLoads.length === 0 && !onFire && (
        <button type="button" className="btn btn--small" onClick={() => sellServer(serverId)}>
          Sell (${RACK_REFURBISH_VALUE[servers.find((s) => s.id === serverId)?.tier ?? ''] ?? 0})
        </button>
      )}

      {hostLoads.length === 0 && (
        <p className="empty-slot">No models loaded. Use Marketplace to load one.</p>
      )}

      {hostLoads.map(renderLoadedModel)}
    </article>
  )
}

export function ServerRack() {
  const servers = useGameStore((s) => s.servers)
  const rackGpus = Object.fromEntries(Object.entries(RACK_CONFIG).map(([k, v]) => [k, v.gpus]))
  const rackRam = Object.fromEntries(Object.entries(RACK_CONFIG).map(([k, v]) => [k, v.ram]))

  return (
    <section className="panel server-rack">
      <h2>Compute</h2>

      <HostRack
        hostId={LAPTOP_HOST_ID}
        title="Laptop"
        gpus={getHostGpus(LAPTOP_HOST_ID, servers, rackGpus)}
        ram={4}
      />

      {servers.map((server) => (
        <HostRack
          key={server.id}
          hostId={server.id}
          serverId={server.id}
          title={server.name}
          gpus={getHostGpus(server.id, servers, rackGpus)}
          ram={rackRam[server.tier] ?? 8}
          onFire={server.onFire}
        />
      ))}

      {servers.length === 0 && (
        <p className="hint">No racks yet. Finish the tutorial and buy a Mark Mini.</p>
      )}
    </section>
  )
}
