import { VENDOR_LIST } from '../game/vendors'
import { useGameStore } from '../game/store'
import type { VendorId } from '../game/types'

export function DeployPanel() {
  const credits = useGameStore((s) => s.credits)
  const servers = useGameStore((s) => s.servers)
  const agents = useGameStore((s) => s.agents)
  const deployAgent = useGameStore((s) => s.deployAgent)
  const buyServer = useGameStore((s) => s.buyServer)
  const buyTokens = useGameStore((s) => s.buyTokens)
  const serverCost = 200 * servers.length

  function handleDeploy(vendorId: VendorId) {
    const target = servers.find(
      (s) => !s.onFire && agents.filter((a) => a.serverId === s.id && a.status !== 'crashed').length < s.capacity,
    )
    if (target) deployAgent(vendorId, target.id)
  }

  return (
    <section className="panel deploy-panel">
      <h2>Vendor Marketplace</h2>
      <p className="hint">Host agents on fictional cloud vendors. Each token is a billable tragedy.</p>

      <div className="vendor-list">
        {VENDOR_LIST.map((vendor) => (
          <article key={vendor.id} className="vendor-card">
            <header>
              <h3>{vendor.name}</h3>
              <span className="vendor-cost">{vendor.tokenCostPerSec} tok/s</span>
            </header>
            <p className="vendor-tagline">{vendor.tagline}</p>
            <ul className="vendor-stats">
              <li>Deploy: ${vendor.deployCost}</li>
              <li>Output: ×{vendor.outputMultiplier}</li>
              <li>Crash risk: {(vendor.crashChance * 1000).toFixed(1)}‰/s</li>
            </ul>
            <button
              type="button"
              className="btn btn--deploy"
              onClick={() => handleDeploy(vendor.id)}
              disabled={credits < vendor.deployCost}
            >
              Deploy Agent
            </button>
          </article>
        ))}
      </div>

      <div className="infra-actions">
        <button type="button" className="btn" onClick={buyServer} disabled={credits < serverCost}>
          Buy Server (${serverCost})
        </button>
        <button type="button" className="btn" onClick={buyTokens} disabled={credits < 50}>
          Buy Tokens ($50 → 400)
        </button>
      </div>
      <p className="hint">Servers: {servers.length} · Auto-deploys to first rack with space</p>
    </section>
  )
}
