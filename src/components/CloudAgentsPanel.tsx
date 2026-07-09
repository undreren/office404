import { syncTestScope } from '../game/projects'
import { getModel } from '../game/models'
import { contextFillPct, effectiveSuccessRate, formatStoryPoints, formatSuccessPct } from '../game/mechanics'
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

  function dutyLabel(agent: (typeof agents)[number]): string {
    if (!agent.job) return 'Idle'
    const project = projects.find((p) => p.id === agent.projectId)
    const client = project?.clientName ?? 'project'
    if (agent.job === 'refactor') return `Opening PRs: ${client}`
    if (agent.job === 'refine') return `Refining scope: ${client}`
    if (agent.job === 'review') return `Reviewing PRs: ${client}`
    if (agent.job === 'test') return `Testing delivery: ${client}`
    const task = findTask(agent.taskId)
    return `Coding: ${task?.title ?? client}`
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
          const task = findTask(agent.taskId)
          const fillPct = model ? contextFillPct(agent.contextUsed, model.contextSize) : 0
          const taskSp = task?.storyPointsRequired ?? 1
          const success = model ? effectiveSuccessRate(model.parameters, taskSp, fillPct) : 0
          const taskPct = task ? (task.storyPointsEarned / task.storyPointsRequired) * 100 : 0

          return (
            <div key={agent.id} className={`agent-card agent-card--cloud agent-card--${agent.status}`}>
              <div className="agent-card__header">
                <strong>{agent.name}</strong>
                <span className="agent-status">{agent.status}</span>
              </div>
              <p className="agent-vendor">{model?.name ?? agent.modelId}</p>
              <p className="agent-personality">{agent.personality}</p>
              <p className="agent-meta">{dutyLabel(agent)}</p>
              {agent.job === 'code' && model && (
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

              {(agent.job === 'review' || agent.job === 'refine' || agent.job === 'refactor') &&
                agent.jobDuration > 0 && (
                <div className="meter-row">
                  <label>
                    {agent.job === 'review'
                      ? 'Review'
                      : agent.job === 'refine'
                        ? 'Refine'
                        : 'PR'}{' '}
                    progress
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

              {agent.job && agent.status !== 'compacted' && model && (
                <div className="meter-row">
                  <label>Context</label>
                  <div className="meter meter--sm">
                    <div
                      className={`meter__fill ${fillPct > 80 ? 'meter__fill--critical' : 'meter__fill--tokens'}`}
                      style={{ width: `${Math.min(100, fillPct)}%` }}
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
              {agent.job && (
                <button type="button" className="btn btn--small btn--danger" onClick={() => unassignAgent(agent.id)}>
                  Yank
                </button>
              )}
              {!agent.job && (
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
