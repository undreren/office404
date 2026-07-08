import { useGameStore } from '../game/store'

export function ResourceBar() {
  const tokens = useGameStore((s) => s.tokens)
  const maxTokens = useGameStore((s) => s.maxTokens)
  const sanity = useGameStore((s) => s.sanity)
  const credits = useGameStore((s) => s.credits)
  const reputation = useGameStore((s) => s.reputation)
  const tokenPriceMultiplier = useGameStore((s) => s.tokenPriceMultiplier)

  const tokenPct = Math.min(100, (tokens / maxTokens) * 100)
  const sanityPct = Math.min(100, sanity)

  return (
    <header className="resource-bar">
      <div className="resource-bar__title">
        <span className="glitch" data-text="OFFICE 404">OFFICE 404</span>
        <small>Intelligence Not Found</small>
      </div>

      <div className="resource-grid">
        <div className="resource">
          <label>Tokens</label>
          <div className="meter">
            <div className="meter__fill meter__fill--tokens" style={{ width: `${tokenPct}%` }} />
          </div>
          <span>
            {Math.floor(tokens)} / {maxTokens}
            {tokenPriceMultiplier > 1 && (
              <em className="surcharge"> (+{Math.round((tokenPriceMultiplier - 1) * 100)}%)</em>
            )}
          </span>
        </div>

        <div className="resource">
          <label>Sanity</label>
          <div className="meter">
            <div
              className={`meter__fill meter__fill--sanity ${sanity < 25 ? 'meter__fill--critical' : ''}`}
              style={{ width: `${sanityPct}%` }}
            />
          </div>
          <span>{Math.floor(sanity)}%</span>
        </div>

        <div className="resource resource--inline">
          <label>Credits</label>
          <span className="value">${Math.floor(credits)}</span>
        </div>

        <div className="resource resource--inline">
          <label>Rep</label>
          <span className="value">{Math.floor(reputation)}</span>
        </div>
      </div>
    </header>
  )
}
