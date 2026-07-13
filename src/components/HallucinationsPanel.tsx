import {
  HALLUCINATION_TRACK_DEFS,
  HALLUCINATION_TRACKS,
  canBuyHallucinationUpgrade,
  getHallucinationLevel,
  hallucinationTrackMaxLevel,
  hallucinationUpgradeCost,
} from '../game/prestige'
import { prestigeHallucinationBuyMsg } from '../game/messages'
import { useGameDispatchPurchase, useGameState } from '../runtime/GameRuntime'

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
          const maxLevel = hallucinationTrackMaxLevel(track)
          const atMax = maxLevel !== null && level >= maxLevel
          const cost = hallucinationUpgradeCost(track, level)
          const affordable = canBuyHallucinationUpgrade(meta, track)
          const def = HALLUCINATION_TRACK_DEFS[track]
          const levelLabel =
            maxLevel !== null ? `Lv ${level}/${maxLevel}` : `Lv ${level}`

          return (
            <article
              key={track}
              className="vendor-card"
              aria-label={`${def.label} ${levelLabel}, ${def.tagline}`}
            >
              <header>
                <h4>{def.label}</h4>
                <span>{levelLabel}</span>
              </header>
              <p className="vendor-tagline">&ldquo;{def.tagline}&rdquo;</p>
              <p className="hint">{def.description}</p>
              <button
                type="button"
                className="btn btn--small"
                aria-label={
                  atMax
                    ? `${def.label} at max level`
                    : affordable
                      ? `Upgrade ${def.label} for ${cost} hallucination points`
                      : `Cannot afford ${def.label} upgrade (${cost} points)`
                }
                disabled={!affordable}
                onClick={() => dispatchPurchase(prestigeHallucinationBuyMsg(Date.now(), track))}
              >
                {atMax ? 'Max level' : `${cost} pts`}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
