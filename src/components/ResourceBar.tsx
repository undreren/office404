import { APARTMENT_CONFIG, WIN_CASH } from '../game/constants'
import { formatGameClock } from '../game/mechanics'
import { MODEL_TIERS } from '../game/models'
import { agentCapacity, getNetWorth } from '../game/selectors'
import { useGamePaused, useGameState } from '../runtime/GameRuntime'
import { NewGameButton } from './NewGameButton'

type ResourceBarProps = {
  compact?: boolean
}

export function ResourceBar({ compact = false }: ResourceBarProps) {
  const state = useGameState()
  const { paused } = useGamePaused()
  const { cash, reputation, gameDay, rentDueInDays, apartment } = state

  const { used, max, totalRam, totalGpus } = agentCapacity(state)
  const model = MODEL_TIERS[state.modelTierIndex]
  const netWorth = getNetWorth(state)
  const winPct = Math.min(100, (netWorth / WIN_CASH) * 100)
  const rentAmount = APARTMENT_CONFIG[apartment].rent

  return (
    <header className={`resource-bar${compact ? ' resource-bar--compact' : ''}`}>
      <div className="resource-bar__header">
        <div className={`resource-bar__title${compact ? ' resource-bar__title--compact' : ''}`}>
          <span className={`glitch${compact ? ' glitch--compact' : ''}`} data-text="OFFICE 404">
            OFFICE 404
          </span>
          <small>
            Intelligence Not Found · {formatGameClock(gameDay)}
            {paused && <span className="resource-bar__paused"> · Paused</span>}
          </small>
        </div>
        <NewGameButton />
      </div>

      <div className="resource-grid">
        <div className="resource">
          <label>Cash</label>
          <span className="value">${Math.floor(cash)}</span>
        </div>

        <div className="resource">
          <label>Retire Goal</label>
          <div className="meter">
            <div className="meter__fill meter__fill--code" style={{ width: `${winPct}%` }} />
          </div>
          <span>${Math.floor(netWorth).toLocaleString()} / $10M</span>
        </div>

        {!compact && (
          <>
            <div className="resource resource--inline">
              <label>Rep</label>
              <span className="value">{Math.floor(reputation)}</span>
            </div>

            <div className="resource resource--inline">
              <label>Home</label>
              <span className="value value--sm">{APARTMENT_CONFIG[apartment].label}</span>
            </div>

            <div className="resource resource--inline">
              <label>Agents</label>
              <span className="value value--sm">
                {used}/{max}
              </span>
            </div>

            <div className="resource resource--inline">
              <label>RAM / GPU</label>
              <span className="value value--sm">
                {totalRam} GB · {totalGpus} GPU
              </span>
            </div>

            <div className="resource resource--inline">
              <label>Model</label>
              <span className="value value--sm">{model.displayName}</span>
            </div>

            <div className="resource resource--inline">
              <label>Rent</label>
              <span className={`value value--sm ${rentDueInDays < 5 ? 'text-danger' : ''}`}>
                ${rentAmount} in {Math.ceil(rentDueInDays)}d
              </span>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
