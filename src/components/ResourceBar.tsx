import { formatCash } from '../game/cash'
import { HOUSING_CONFIG } from '../game/housing'
import { formatGameClock, formatPercent } from '../game/mechanics'
import { getHallucinationLevel } from '../game/meta'
import { MODEL_TIERS } from '../game/models'
import { personalRetirementThreshold } from '../game/prestige'
import { agentCapacity } from '../game/selectors'
import { useGamePaused, useGameState } from '../runtime/GameRuntime'
import { NewGameButton } from './NewGameButton'

type ResourceBarProps = {
  compact?: boolean
}

export function ResourceBar({ compact = false }: ResourceBarProps) {
  const state = useGameState()
  const { paused } = useGamePaused()
  const { cash, reputation, gameDay, rentDueInDays, apartment, mrr, meta } = state

  const { used, max, agentSlots, gpuTicks, usedRamGb } = agentCapacity(state)
  const modelLevel = getHallucinationLevel(meta, 'model')
  const model = MODEL_TIERS[Math.min(modelLevel, MODEL_TIERS.length - 1)]!
  const retireThreshold = personalRetirementThreshold(meta.retirementCount)
  const retirePct = Math.min(100, (cash / retireThreshold) * 100)
  const housing = HOUSING_CONFIG[apartment]
  const rentAmount = housing.rent
  const compactSummary = compact
    ? [
        `Cash ${formatCash(cash)}`,
        `retire ${formatCash(cash)} of ${formatCash(retireThreshold)}`,
        `MRR ${formatCash(mrr)}/day`,
        `reputation ${Math.floor(reputation)}`,
        `home ${housing.label}`,
        `agents ${used}/${max}`,
        `${usedRamGb}/${agentSlots} GB RAM · ${gpuTicks} GPU`,
        `model ${model.displayName}`,
        `rent ${formatCash(rentAmount)} due in ${Math.ceil(rentDueInDays)} days`,
        paused ? 'paused' : null,
      ]
        .filter(Boolean)
        .join(', ')
    : undefined

  return (
    <header className={`resource-bar${compact ? ' resource-bar--compact' : ''}`}>
      <div className="resource-bar__header">
        <div className={`resource-bar__title${compact ? ' resource-bar__title--compact' : ''}`}>
          <span className={`glitch${compact ? ' glitch--compact' : ''}`} data-text="OFFICE 404">
            OFFICE 404
          </span>
          <small aria-label={`Game clock: ${formatGameClock(gameDay)}${paused ? ', paused' : ''}`}>
            <span className="resource-bar__tagline">Intelligence Not Found</span>
            <span className="resource-bar__clock">
              {formatGameClock(gameDay)}
              {paused && <span className="resource-bar__paused"> · Paused</span>}
            </span>
          </small>
        </div>
        <NewGameButton />
      </div>

      <div className="resource-grid" role="region" aria-label={compactSummary ?? 'Resources'}>
        <div className="resource" aria-label={`Cash: ${formatCash(cash)}`}>
          <label>Cash</label>
          <span className="value">{formatCash(cash)}</span>
        </div>

        <div
          className="resource"
          aria-label={`Retire goal: ${formatCash(cash)} of ${formatCash(retireThreshold)} (${formatPercent(retirePct)}%)`}
        >
          <label>Retire Goal</label>
          <div className="meter">
            <div className="meter__fill meter__fill--code" style={{ width: `${retirePct}%` }} />
          </div>
          <span>
            {formatCash(cash)} / {formatCash(retireThreshold)}
          </span>
        </div>

        {!compact && (
          <>
            <div className="resource resource--inline" aria-label={`MRR: ${formatCash(mrr)} per day`}>
              <label>MRR</label>
              <span className="value value--sm">{formatCash(mrr)}/d</span>
            </div>

            <div className="resource resource--inline" aria-label={`Reputation: ${Math.floor(reputation)}`}>
              <label>Rep</label>
              <span className="value">{Math.floor(reputation)}</span>
            </div>

            <div className="resource resource--inline" aria-label={`Home: ${housing.label}`}>
              <label>Home</label>
              <span className="value value--sm">{housing.label}</span>
            </div>

            <div className="resource resource--inline" aria-label={`Agents: ${used} of ${max} staffed`}>
              <label>Agents</label>
              <span className="value value--sm">
                {used}/{max}
              </span>
            </div>

            <div
              className="resource resource--inline"
              aria-label={`${usedRamGb} of ${agentSlots} gigabytes RAM used, ${gpuTicks} GPU`}
            >
              <label>RAM / GPU</label>
              <span className="value value--sm">
                {usedRamGb}/{agentSlots} GB · {gpuTicks}
              </span>
            </div>

            <div className="resource resource--inline" aria-label={`Model: ${model.displayName}`}>
              <label>Model</label>
              <span className="value value--sm">{model.displayName}</span>
            </div>

            <div
              className="resource resource--inline"
              aria-label={`Rent: ${formatCash(rentAmount)} due in ${Math.ceil(rentDueInDays)} days`}
            >
              <label>Rent</label>
              <span className={`value value--sm ${rentDueInDays < 5 ? 'text-danger' : ''}`}>
                {formatCash(rentAmount)} in {Math.ceil(rentDueInDays)}d
              </span>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
