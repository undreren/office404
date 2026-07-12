import { APARTMENT_CONFIG, WIN_CASH } from '../game/constants'
import { MODEL_TIERS } from '../game/models'
import { agentCapacity, getNetWorth, useGameStore } from '../game/store'
import { NewGameButton } from './NewGameButton'

type ResourceBarProps = {
  variant?: 'full' | 'compact'
}

export function ResourceBar({ variant = 'full' }: ResourceBarProps) {
  const cash = useGameStore((s) => s.cash)
  const reputation = useGameStore((s) => s.reputation)
  const gameDay = useGameStore((s) => s.gameDay)
  const rentDueInDays = useGameStore((s) => s.rentDueInDays)
  const apartment = useGameStore((s) => s.apartment)
  const state = useGameStore()

  const { used, max, totalRam, totalGpus } = agentCapacity(state)
  const model = MODEL_TIERS[state.modelTierIndex]
  const netWorth = getNetWorth(state)
  const winPct = Math.min(100, (netWorth / WIN_CASH) * 100)
  const rentAmount = APARTMENT_CONFIG[apartment].rent

  if (variant === 'compact') {
    return (
      <header className="resource-bar resource-bar--compact">
        <div className="resource-bar--compact__stats">
          <div className="resource-bar--compact__stat">
            <label>Cash</label>
            <span className="value">${Math.floor(cash)}</span>
          </div>
          <div className="resource-bar--compact__stat">
            <label>Day</label>
            <span className="value">{Math.floor(gameDay)}</span>
          </div>
          <div className="resource-bar--compact__stat resource-bar--compact__stat--grow">
            <label>Retire</label>
            <div className="meter meter--sm">
              <div className="meter__fill meter__fill--code" style={{ width: `${winPct}%` }} />
            </div>
            <span className="value value--sm">{Math.floor(winPct)}%</span>
          </div>
        </div>
        <NewGameButton />
      </header>
    )
  }

  return (
    <header className="resource-bar">
      <div className="resource-bar__header">
        <div className="resource-bar__title">
          <span className="glitch" data-text="OFFICE 404">
            OFFICE 404
          </span>
          <small>Intelligence Not Found · Day {Math.floor(gameDay)}</small>
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
      </div>
    </header>
  )
}
