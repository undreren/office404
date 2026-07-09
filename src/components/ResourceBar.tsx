import { APARTMENT_CONFIG, WIN_NET_WORTH } from '../game/constants'
import { getNetWorth, useGameStore } from '../game/store'
import { NewGameButton } from './NewGameButton'

export function ResourceBar() {
  const cash = useGameStore((s) => s.cash)
  const tokens = useGameStore((s) => s.tokens)
  const maxTokens = useGameStore((s) => s.maxTokens)
  const sanity = useGameStore((s) => s.sanity)
  const reputation = useGameStore((s) => s.reputation)
  const gameDay = useGameStore((s) => s.gameDay)
  const rentDueInDays = useGameStore((s) => s.rentDueInDays)
  const apartment = useGameStore((s) => s.apartment)
  const servers = useGameStore((s) => s.servers)
  const usedRam = useGameStore((s) => s.usedRam)
  const totalRam = useGameStore((s) => s.totalRam)

  const tokenPct = Math.min(100, (tokens / maxTokens) * 100)
  const netWorth = getNetWorth({ cash, servers })
  const winPct = Math.min(100, (netWorth / WIN_NET_WORTH) * 100)
  const rentAmount = APARTMENT_CONFIG[apartment].rent

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
          <label>Net Worth</label>
          <div className="meter">
            <div className="meter__fill meter__fill--code" style={{ width: `${winPct}%` }} />
          </div>
          <span>${Math.floor(netWorth).toLocaleString()} / $10M</span>
        </div>

        <div className="resource">
          <label>Tokens</label>
          <div className="meter">
            <div className="meter__fill meter__fill--tokens" style={{ width: `${tokenPct}%` }} />
          </div>
          <span>
            {Math.floor(tokens)} / {maxTokens}
          </span>
        </div>

        <div className="resource">
          <label>Sanity</label>
          <div className="meter">
            <div
              className={`meter__fill meter__fill--sanity ${sanity < 25 ? 'meter__fill--critical' : ''}`}
              style={{ width: `${Math.min(100, sanity)}%` }}
            />
          </div>
          <span>{Math.floor(sanity)}%</span>
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
          <label>RAM</label>
          <span className="value">
            {usedRam.toFixed(1)}/{totalRam} GB
          </span>
        </div>

        <div className="resource resource--inline">
          <label>Rent</label>
          <span className="value">
            ${rentAmount} in {Math.ceil(rentDueInDays)}d
          </span>
        </div>
      </div>
    </header>
  )
}
