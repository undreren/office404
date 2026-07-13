import {
  HALLUCINATION_TRACKS,
  canBuyHallucinationUpgrade,
  getHallucinationLevel,
  hallucinationUpgradeCost,
  type HallucinationTrack,
} from '../game/prestige'
import { prestigeHallucinationBuyMsg } from '../game/messages'
import { useGameDispatchPurchase, useGameState } from '../runtime/GameRuntime'

const TRACK_LABELS: Record<HallucinationTrack, string> = {
  model: 'Model tier',
  context: 'Context window',
  compaction: 'Faster compaction',
  starting_capital: 'Starting capital',
  in_house: 'In-house product',
  procurement: 'Procurement AI',
  customer: 'Customer agent',
  project_manager: 'Project manager',
  project_slots: 'Client project slots',
  fine_tune: 'Fine-tune unlocks',
  sales: 'Sales automation',
  marketing: 'Marketing boost',
  accounting: 'Accounting tricks',
  super_conductor: 'Super conductor',
}

export function HallucinationsPanel() {
  const { meta } = useGameState()
  const dispatchPurchase = useGameDispatchPurchase()

  return (
    <section className="panel hallucinations-panel">
      <h2>Hallucinations</h2>
      <p className="panel__subtitle">
        Prestige currency from retirement. Spend it on things that were never in the roadmap.
      </p>
      <p className="hint" aria-label={`${meta.hallucinationPoints} unspent hallucination points`}>
        {meta.hallucinationPoints} unspent point{meta.hallucinationPoints === 1 ? '' : 's'} ·{' '}
        {meta.retirementCount} retirement{meta.retirementCount === 1 ? '' : 's'}
      </p>

      <div className="vendor-list">
        {HALLUCINATION_TRACKS.map((track) => {
          const level = getHallucinationLevel(meta, track)
          const cost = hallucinationUpgradeCost(track, level)
          const affordable = canBuyHallucinationUpgrade(meta, track)
          const label = TRACK_LABELS[track]

          return (
            <article
              key={track}
              className="vendor-card"
              aria-label={`${label} level ${level}, next costs ${cost} points`}
            >
              <header>
                <h4>{label}</h4>
                <span>Lv {level}</span>
              </header>
              <button
                type="button"
                className="btn btn--small"
                aria-label={
                  affordable
                    ? `Upgrade ${label} for ${cost} hallucination points`
                    : `Cannot afford ${label} upgrade (${cost} points)`
                }
                disabled={!affordable}
                onClick={() => dispatchPurchase(prestigeHallucinationBuyMsg(Date.now(), track))}
              >
                {cost} pts
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
