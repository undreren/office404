import { formatCash } from '../game/cash'
import { formatStoryPoints } from '../game/mechanics'
import { maxProductProjectSlots } from '../game/prestige'
import { canAccessProduct, countActiveProductProjects } from '../game/product'
import { activateProductFeatureMsg } from '../game/messages'
import { useGameDispatchPurchase, useGameState } from '../runtime/GameRuntime'
import { ProjectCard } from './ProjectsPanel'

export function ProductPanel() {
  const state = useGameState()
  const dispatchPurchase = useGameDispatchPurchase()
  const { meta, mrr, productBacklog, projects, productFeaturesShipped } = state

  if (!canAccessProduct(meta)) {
    return (
      <section className="panel product-panel">
        <h2>Product</h2>
        <p className="hint">Unlock In-house product in Hallucinations to build your MRR monolith.</p>
      </section>
    )
  }

  const activeProjects = projects.filter((p) => p.kind === 'product' && p.status === 'active')
  const queuedItems = productBacklog.filter((item) => item.status === 'queued')
  const maxSlots = maxProductProjectSlots(meta)
  const activeCount = countActiveProductProjects(projects)
  const slotsAvailable = activeCount < maxSlots

  return (
    <section className="panel product-panel">
      <h2>Product</h2>
      <p className="panel__subtitle">In-house features that print MRR. Same pipeline, fewer client tantrums.</p>
      <p className="hint" aria-label={`MRR ${formatCash(mrr)} per day, ${productFeaturesShipped} features shipped`}>
        {formatCash(mrr)}/day MRR · {productFeaturesShipped} feature{productFeaturesShipped === 1 ? '' : 's'} shipped ·{' '}
        {activeCount}/{maxSlots} active slot{maxSlots === 1 ? '' : 's'}
      </p>

      {queuedItems.length > 0 && (
        <section className="product-backlog" aria-labelledby="product-backlog-heading">
          <h3 id="product-backlog-heading">Backlog</h3>
          <ul className="product-backlog__list">
            {queuedItems.map((item) => {
              const canStart = slotsAvailable
              return (
                <li key={item.id}>
                  <article className="vendor-card" aria-label={`${item.title}, ${formatStoryPoints(item.storyPoints)} story points`}>
                    <header>
                      <h4>{item.title}</h4>
                      <span>{formatStoryPoints(item.storyPoints)} SP</span>
                    </header>
                    <p className="hint">
                      {slotsAvailable
                        ? 'Kick off for free. Ship for recurring revenue.'
                        : 'All product slots are busy — ship an active feature first.'}
                    </p>
                    <button
                      type="button"
                      className="btn btn--small"
                      data-testid={`activate-product-${item.id}`}
                      disabled={!canStart}
                      aria-label={
                        canStart
                          ? `Start ${item.title}`
                          : `No open product slots for ${item.title}`
                      }
                      onClick={() => dispatchPurchase(activateProductFeatureMsg(Date.now(), item.id))}
                    >
                      Start
                    </button>
                  </article>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {activeProjects.length > 0 ? (
        <section className="product-active" aria-labelledby="product-active-heading">
          <h3 id="product-active-heading">Active features</h3>
          <div className="product-active__list">
            {activeProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      ) : queuedItems.length > 0 ? (
        <p className="hint">No active features yet — pick one from Backlog above and hit Start.</p>
      ) : (
        <p className="hint">Your feature backlog is empty. Reload the page — a queued feature should appear shortly.</p>
      )}
    </section>
  )
}
