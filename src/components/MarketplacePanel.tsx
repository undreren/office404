import { useState } from 'react'
import { APARTMENT_CONFIG, GPU_UPGRADE_COST, RACK_CONFIG, TOKEN_PACK_AMOUNT, TOKEN_PACK_COST } from '../game/constants'
import { CLOUD_MODEL_LIST, CLOUD_VENDORS, LOCAL_MODEL_LIST } from '../game/models'
import { getNextApartment, useGameStore } from '../game/store'
import type { RackTier } from '../game/types'

export function MarketplacePanel() {
  const cash = useGameStore((s) => s.cash)
  const servers = useGameStore((s) => s.servers)
  const agents = useGameStore((s) => s.agents)
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

  const [selectedServerId, setSelectedServerId] = useState<string>(() => servers[0]?.id ?? '')

  const apt = APARTMENT_CONFIG[apartment]
  const nextApt = getNextApartment({ apartment })
  const rackSlotsLeft = apt.rackSlots - servers.length
  const activeServerId = servers.some((s) => s.id === selectedServerId) ? selectedServerId : (servers[0]?.id ?? '')

  function agentsOnServer(serverId: string): number {
    return agents.filter((a) => a.serverId === serverId).length
  }

  function handleCloudDeploy(modelId: string) {
    if (activeServerId) deployCloudAgent(modelId, activeServerId)
  }

  function handleLocalInstall(modelId: string) {
    if (activeServerId) installLocalAgent(modelId, activeServerId)
  }

  return (
    <section className="panel marketplace-panel">
      <h2>Marketplace</h2>

      {servers.length > 0 && (
        <div className="server-picker">
          <label htmlFor="deploy-server">Deploy to rack</label>
          <select
            id="deploy-server"
            value={activeServerId}
            onChange={(e) => setSelectedServerId(e.target.value)}
          >
            {servers.map((s) => (
              <option key={s.id} value={s.id} disabled={s.onFire}>
                {s.name} ({agentsOnServer(s.id)} loaded{s.onFire ? ' — ON FIRE' : ''})
              </option>
            ))}
          </select>
          <p className="hint">Models on the same rack share GPU — more models = slower ticks.</p>
        </div>
      )}

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
                disabled={!ownedLocalModels.includes(model.id) || usedRam + model.ramCost > totalRam || !activeServerId}
              >
                Install
              </button>
            </article>
          ))}
        </div>
      </div>

      <div className="market-section">
        <h3>Cloud Vendors</h3>
        <p className="hint">Each token is a billable tragedy. Pick your poison.</p>
        {(Object.values(CLOUD_VENDORS) as (typeof CLOUD_VENDORS)[keyof typeof CLOUD_VENDORS][]).map((vendor) => {
          const model = CLOUD_MODEL_LIST.find((m) => m.vendor === vendor.id)
          if (!model) return null

          return (
            <article key={vendor.id} className="vendor-card vendor-card--cloud">
              <header>
                <h4>{vendor.name}</h4>
                <span>{model.tokenCostPerTick} tok/tick</span>
              </header>
              <p className="vendor-tagline">{vendor.tagline}</p>
              <ul className="vendor-stats">
                <li>Deploy: ${model.deployCost}</li>
                <li>{model.parameters}B params</li>
                <li>{model.contextSize}k context</li>
                <li>{Math.round(model.successChance * 100)}% success</li>
              </ul>
              <button
                type="button"
                className="btn btn--deploy"
                onClick={() => handleCloudDeploy(model.id)}
                disabled={cash < model.deployCost || !activeServerId}
              >
                Deploy
              </button>
            </article>
          )
        })}
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
