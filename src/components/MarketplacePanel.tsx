import { APARTMENT_CONFIG, GPU_UPGRADE_COST, RACK_CONFIG, TOKEN_PACK_AMOUNT, TOKEN_PACK_COST } from '../game/constants'
import { CLOUD_MODEL_LIST, LOCAL_MODEL_LIST } from '../game/models'
import { getNextApartment, useGameStore } from '../game/store'
import type { RackTier } from '../game/types'

export function MarketplacePanel() {
  const cash = useGameStore((s) => s.cash)
  const servers = useGameStore((s) => s.servers)
  const apartment = useGameStore((s) => s.apartment)
  const ownedLocalModels = useGameStore((s) => s.ownedLocalModels)
  const usedRam = useGameStore((s) => s.usedRam)
  const totalRam = useGameStore((s) => s.totalRam)
  const deployCloudAgent = useGameStore((s) => s.deployCloudAgent)
  const installLocalAgent = useGameStore((s) => s.installLocalAgent)
  const buyServer = useGameStore((s) => s.buyServer)
  const buyTokens = useGameStore((s) => s.buyTokens)
  const upgradeGpu = useGameStore((s) => s.upgradeGpu)
  const upgradeApartment = useGameStore((s) => s.upgradeApartment)

  const apt = APARTMENT_CONFIG[apartment]
  const nextApt = getNextApartment({ apartment })
  const rackSlotsLeft = apt.rackSlots - servers.length

  function firstAvailableServer() {
    return servers.find((s) => !s.onFire)
  }

  function handleCloudDeploy(modelId: string) {
    const server = firstAvailableServer()
    if (server) deployCloudAgent(modelId, server.id)
  }

  function handleLocalInstall(modelId: string) {
    const server = firstAvailableServer()
    if (server) installLocalAgent(modelId, server.id)
  }

  return (
    <section className="panel marketplace-panel">
      <h2>Marketplace</h2>

      <div className="market-section">
        <h3>Local Shelf (free, depressing)</h3>
        <div className="vendor-list">
          {LOCAL_MODEL_LIST.map((model) => (
            <article key={model.id} className="vendor-card">
              <header>
                <h4>{model.name}</h4>
                <span>{model.ramCost} GB RAM</span>
              </header>
              <p className="vendor-tagline">{model.tagline}</p>
              <ul className="vendor-stats">
                <li>{model.parameters}B params</li>
                <li>{model.contextSize}k context</li>
                <li>{Math.round(model.successChance * 100)}% success</li>
              </ul>
              <button
                type="button"
                className="btn btn--deploy"
                onClick={() => handleLocalInstall(model.id)}
                disabled={!ownedLocalModels.includes(model.id) || usedRam + model.ramCost > totalRam}
              >
                Install
              </button>
            </article>
          ))}
        </div>
      </div>

      <div className="market-section">
        <h3>Fabulous5 Cloud (à la carte)</h3>
        <div className="vendor-list">
          {CLOUD_MODEL_LIST.map((model) => (
            <article key={model.id} className="vendor-card vendor-card--cloud">
              <header>
                <h4>{model.name}</h4>
                <span>{model.tokenCostPerTick} tok/tick</span>
              </header>
              <p className="vendor-tagline">{model.tagline}</p>
              <ul className="vendor-stats">
                <li>Deploy: ${model.deployCost}</li>
                <li>{model.parameters}B params</li>
                <li>{model.contextSize}k context</li>
              </ul>
              <button
                type="button"
                className="btn btn--deploy"
                onClick={() => handleCloudDeploy(model.id)}
                disabled={cash < model.deployCost}
              >
                Deploy
              </button>
            </article>
          ))}
        </div>
      </div>

      <div className="infra-actions">
        {(Object.entries(RACK_CONFIG) as [RackTier, (typeof RACK_CONFIG)[string]][]).map(([tier, cfg]) => (
          <button
            key={tier}
            type="button"
            className="btn"
            onClick={() => buyServer(tier)}
            disabled={cash < cfg.cost || rackSlotsLeft <= 0}
          >
            {cfg.label} (${cfg.cost})
          </button>
        ))}
        <button type="button" className="btn" onClick={buyTokens} disabled={cash < TOKEN_PACK_COST}>
          Tokens (${TOKEN_PACK_COST} → {TOKEN_PACK_AMOUNT})
        </button>
        <button type="button" className="btn" onClick={upgradeGpu} disabled={cash < GPU_UPGRADE_COST}>
          GPU +1 (${GPU_UPGRADE_COST})
        </button>
        {nextApt && (
          <button
            type="button"
            className="btn btn--sprint"
            onClick={upgradeApartment}
            disabled={cash < APARTMENT_CONFIG[nextApt].upgradeCost}
          >
            Upgrade → {APARTMENT_CONFIG[nextApt].label}
          </button>
        )}
      </div>
      <p className="hint">
        Racks: {servers.length}/{apt.rackSlots} · RAM: {usedRam}/{totalRam} GB
      </p>
    </section>
  )
}
