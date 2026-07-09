import { getModel } from '../game/models'
import { useGameStore } from '../game/store'
import type { Task } from '../game/types'

export function CloudAgentsPanel() {
  const agents = useGameStore((s) => s.agents)
  const projects = useGameStore((s) => s.projects)
  const restartAgent = useGameStore((s) => s.restartAgent)
  const unassignAgent = useGameStore((s) => s.unassignAgent)
  const offloadAgent = useGameStore((s) => s.offloadAgent)

  const cloudAgents = agents.filter((a) => getModel(a.modelId)?.kind === 'cloud')

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
    <section className="panel cloud-agents-panel">
      <h2>Cloud Agents</h2>
      <p className="hint">Hosted off-rack. Full tick speed. Your wallet&apos;s problem.</p>

      <div className="agent-grid">
        {cloudAgents.length === 0 && (
          <p className="empty-slot">No cloud agents deployed. Buy tokens, deploy a vendor, pray.</p>
        )}
        {cloudAgents.map((agent) => {
          const model = getModel(agent.modelId)
          const contextPct = model ? (agent.contextUsed / model.contextSize) * 100 : 0
          const task = findTask(agent.taskId)
          const taskPct = task ? (task.storyPointsEarned / task.storyPointsRequired) * 100 : 0

          return (
            <div key={agent.id} className={`agent-card agent-card--cloud agent-card--${agent.status}`}>
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

              {model && (
                <p className="agent-meta">
                  {model.tokenCostPerTick} tok/tick · {agent.totalTokensBurned.toFixed(0)} burned
                </p>
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
                  Terminate
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
