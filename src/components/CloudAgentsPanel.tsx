import { COMPACT_DURATION_SEC } from '../game/constants'
import { getModel } from '../game/models'
import { contextFillPct, effectiveSuccessRate, formatAgentDutyLabel, formatStoryPoints, formatSuccessPct } from '../game/mechanics'
import { useGameStore } from '../game/store'
import type { Task } from '../game/types'

export function CloudAgentsPanel() {
  const agents = useGameStore((s) => s.agents)
  const projects = useGameStore((s) => s.projects)
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
    const project = projects.find((p) => p.id === agent.projectId)
    const task = findTask(agent.taskId)
    return formatAgentDutyLabel(agent, project?.clientName, task?.title)
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
                <span className="agent-status">
                  {agent.job && agent.status === 'idle' ? 'idle (assigned)' : agent.status}
                </span>
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

              {agent.job === 'test' && task && (
                <div className="meter-row">
                  <label>QA progress</label>
                  <div className="meter meter--sm">
                    <div
                      className="meter__fill meter__fill--sanity"
                      style={{
                        width: `${Math.min(100, (task.testStoryPointsEarned / task.storyPointsRequired) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="task-sp">
                    {formatStoryPoints(task.testStoryPointsEarned)} /{' '}
                    {formatStoryPoints(task.storyPointsRequired)} SP
                  </span>
                </div>
              )}

              {agent.job && agent.status !== 'compacting' && agent.status !== 'compacted' && model && (
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

              {agent.status === 'compacting' && (
                <div className="meter-row">
                  <label>Auto-compacting</label>
                  <div className="meter meter--sm">
                    <div
                      className="meter__fill meter__fill--danger"
                      style={{
                        width: `${Math.min(100, ((COMPACT_DURATION_SEC - agent.compactingRemainingSec) / COMPACT_DURATION_SEC) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="task-sp">{agent.compactingRemainingSec.toFixed(0)}s</span>
                </div>
              )}

              {model && (
                <p className="agent-meta">
                  {model.tokenCostPerTick} tok/tick · {agent.totalTokensBurned.toFixed(0)} burned
                </p>
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
