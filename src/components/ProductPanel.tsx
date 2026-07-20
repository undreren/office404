import { useEffect, useRef } from 'react'
import { formatCash } from '../game/cash'
import { formatStoryPoints } from '../game/mechanics'
import { maxProductProjectSlots, effectiveMrr } from '../game/prestige'
import { canAccessProduct, countActiveProductProjects } from '../game/product'
import { isReadyToDeliver } from '../game/simulation/gameLogic'
import { activateProductFeatureMsg } from '../game/messages'
import type { ProductBacklogItem, Project } from '../game/types'
import { useTabNav } from '../context/TabNavContext'
import { useGameDispatchPurchase, useGameState } from '../runtime/GameRuntime'
import { ProjectCard } from './ProjectsPanel'

function ProductBacklogCard({
  item,
  canStart,
  onStart,
}: {
  item: ProductBacklogItem
  canStart: boolean
  onStart: () => void
}) {
  return (
    <article
      className="vendor-card"
      aria-label={`${item.title}, ${formatStoryPoints(item.storyPoints)} story points`}
    >
      <header>
        <h4>{item.title}</h4>
        <span>{formatStoryPoints(item.storyPoints)} SP</span>
      </header>
      <p className="hint">
        {canStart
          ? 'Kick off for free. Ship for recurring revenue.'
          : 'All product slots are busy — ship an active feature first.'}
      </p>
      <button
        type="button"
        className="btn btn--small"
        data-testid={`activate-product-${item.id}`}
        disabled={!canStart}
        aria-label={canStart ? `Start ${item.title}` : `No open product slots for ${item.title}`}
        onClick={onStart}
      >
        Start
      </button>
    </article>
  )
}

export function ProductPanel() {
  const state = useGameState()
  const dispatchPurchase = useGameDispatchPurchase()
  const { productIndex, setProductIndex } = useTabNav()
  const { meta, mrr, productBacklog, projects, productFeaturesShipped } = state
  const displayMrr = effectiveMrr(mrr, meta)
  const columnsRef = useRef<HTMLDivElement>(null)
  const unlocked = canAccessProduct(meta)
  const maxSlots = unlocked ? maxProductProjectSlots(meta) : 0

  useEffect(() => {
    if (!unlocked) return
    const clamped = Math.min(productIndex, Math.max(0, maxSlots - 1))
    if (clamped !== productIndex) setProductIndex(clamped)
  }, [maxSlots, productIndex, setProductIndex, unlocked])

  useEffect(() => {
    if (!unlocked) return
    const container = columnsRef.current
    if (!container) return
    const column = container.querySelector<HTMLElement>(`[data-product-slot="${productIndex}"]`)
    column?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }, [productIndex, unlocked])

  if (!unlocked) {
    return (
      <section className="panel product-panel">
        <h2>Product</h2>
        <p className="hint">Unlock In-house product in Hallucinations to build your MRR monolith.</p>
      </section>
    )
  }

  const activeProjects = projects
    .filter((p): p is Project => p.kind === 'product' && p.status === 'active')
    .sort((a, b) => a.id.localeCompare(b.id))
  const queuedItems = productBacklog.filter((item) => item.status === 'queued')
  const activeCount = countActiveProductProjects(projects)
  const slotsAvailable = activeCount < maxSlots

  return (
    <section className="panel product-panel">
      <header className="project-columns__header">
        <h2>Product</h2>
        <p className="panel__subtitle">In-house features that print MRR. Same pipeline, fewer client tantrums.</p>
        <p
          className="hint"
          aria-label={`MRR ${formatCash(displayMrr)} per day, ${productFeaturesShipped} features shipped`}
        >
          {formatCash(displayMrr)}/day MRR · {productFeaturesShipped} feature
          {productFeaturesShipped === 1 ? '' : 's'} shipped · {activeCount}/{maxSlots} active slot
          {maxSlots === 1 ? '' : 's'}
        </p>
      </header>

      <div
        ref={columnsRef}
        className="project-columns"
        role="list"
        aria-label="In-house product slots"
      >
        {Array.from({ length: maxSlots }, (_, slot) => {
          const project = activeProjects[slot]
          const queued = !project ? queuedItems[slot - activeProjects.length] : undefined
          const columnLabel = project?.blurb ?? queued?.title ?? `Slot ${slot + 1}`
          const isFocused = productIndex === slot

          return (
            <section
              key={slot}
              data-product-slot={slot}
              className={`project-column ${isFocused ? 'project-column--focused' : ''} ${project && isReadyToDeliver(project) ? 'project-column--deliverable' : ''}`}
              role="listitem"
              aria-label={columnLabel}
              onClick={() => setProductIndex(slot)}
            >
              <header className="project-column__header">
                <h3>{project?.blurb ?? queued?.title ?? 'Open slot'}</h3>
                {project && <p className="project-column__subtitle">In-House Product · MRR or bust.</p>}
                {queued && !project && (
                  <p className="project-column__subtitle">
                    {formatStoryPoints(queued.storyPoints)} SP · queued
                  </p>
                )}
                {!project && !queued && (
                  <p className="project-column__subtitle">Waiting for the next feature in backlog.</p>
                )}
              </header>

              <div className="project-column__body">
                {project && <ProjectCard project={project} />}
                {queued && !project && (
                  <ProductBacklogCard
                    item={queued}
                    canStart={slotsAvailable}
                    onStart={() => dispatchPurchase(activateProductFeatureMsg(Date.now(), queued.id))}
                  />
                )}
                {!project && !queued && (
                  <p className="empty-slot" aria-label="No queued feature for this slot.">
                    No queued feature for this slot.
                  </p>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}
