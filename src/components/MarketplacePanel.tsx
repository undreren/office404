import { useState } from 'react'
import { APARTMENT_CONFIG, RACK_CONFIG, TOKEN_PACK_AMOUNT, TOKEN_PACK_COST } from '../game/constants'
import { CLOUD_MODEL_LIST, CLOUD_VENDORS, LOCAL_MODEL_LIST } from '../game/models'
import { LAPTOP_HOST_ID, effectiveSuccessRate, formatSuccessPct } from '../game/mechanics'
import { getNextApartment, modelSuccessForTask, useGameStore } from '../game/store'
import type { RackTier } from '../game/types'

export function MarketplacePanel() {
  const cash = useGameStore((s) => s.cash)
  const servers = useGameStore((s) => s.servers)
  const agents = useGameStore((s) => s.agents)
  const loadedModels = useGameStore((s) => s.loadedModels)
  const apartment = useGameStore((s) => s.apartment)
  const ownedLocalModels = useGameStore((s) => s.ownedLocalModels)
  const usedRam = useGameStore((s) => s.usedRam)
  const totalRam = useGameStore((s) => s.totalRam)
  const deployCloudAgent = useGameStore((s) => s.deployCloudAgent)
  const loadLocalModel = useGameStore((s) => s.loadLocalModel)
  const buyServer = useGameStore((s) => s.buyServer)
  const buyTokens = useGameStore((s) => s.buyTokens)
  const upgradeApartment = useGameStore((s) => s.upgradeApartment)

  const [selectedHostId, setSelectedHostId] = useState<string>(LAPTOP_HOST_ID)

  const apt = APARTMENT_CONFIG[apartment]
  const nextApt = getNextApartment({ apartment })
  const rackSlotsLeft = apt.rackSlots - servers.length
  const hostOptions = [
    { id: LAPTOP_HOST_ID, label: 'Laptop (1B only)' },
    ...servers.map((s) => ({ id: s.id, label: s.name })),
  ]
  const activeHostId = hostOptions.some((h) => h.id === selectedHostId)
    ? selectedHostId
    : (hostOptions[0]?.id ?? LAPTOP_HOST_ID)

  function handleLoad(modelId: string, forceNew = false) {
    loadLocalModel(modelId, activeHostId, forceNew)
  }

  function successLabel(modelId: string): string {
    const rate = modelSuccessForTask(modelId, 1)
    return formatSuccessPct(rate)
  }

  return (
    <section className="panel marketplace-panel">
      <h2>Marketplace</h2>

      <div className="server-picker">
        <label htmlFor="deploy-host">Load local model on</label>
        <select
          id="deploy-host"
          value={activeHostId}
          onChange={(e) => setSelectedHostId(e.target.value)}
        >
          {hostOptions.map((h) => (
            <option key={h.id} value={h.id}>
              {h.label}
            </option>
          ))}
        </select>
        <p className="hint">
          Load once, spawn workers. RAM = load + ½ load per active task. Agents on a host share GPUs.
        </p>
      </div>

      <div className="market-section">
        <h3>Local Shelf (owned, depressing)</h3>
        <div className="vendor-list">
          {LOCAL_MODEL_LIST.map((model) => {
            const onHost = loadedModels.some(
              (lm) => lm.hostId === activeHostId && lm.modelId === model.id,
            )
            const laptopBlocked = activeHostId === LAPTOP_HOST_ID && model.id !== 'local-1b'
            return (
              <article key={model.id} className="vendor-card">
                <header>
                  <h4>{model.name}</h4>
                  <span>{model.loadRam} GB load</span>
                </header>
                <p className="vendor-tagline">{model.tagline}</p>
                <ul className="vendor-stats">
                  <li>{model.parameters}B params</li>
                  <li>{model.contextSize}k context</li>
                  <li>{successLabel(model.id)} on 1 SP</li>
                </ul>
                <div className="action-row">
                  <button
                    type="button"
                    className="btn btn--deploy"
                    onClick={() => handleLoad(model.id)}
                    disabled={!ownedLocalModels.includes(model.id) || laptopBlocked}
                  >
                    {onHost ? 'Spawn worker' : 'Load model'}
                  </button>
                  {onHost && (
                    <button
                      type="button"
                      className="btn btn--small"
                      onClick={() => handleLoad(model.id, true)}
                      disabled={!ownedLocalModels.includes(model.id) || laptopBlocked}
                    >
                      New instance
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <div className="market-section">
        <h3>Cloud Vendors</h3>
        <p className="hint">Hosted off-rack at full tick speed. Each token is a billable tragedy.</p>
        {(Object.values(CLOUD_VENDORS) as (typeof CLOUD_VENDORS)[keyof typeof CLOUD_VENDORS][]).map((vendor) => {
          const model = CLOUD_MODEL_LIST.find((m) => m.vendor === vendor.id)
          if (!model) return null
          const rate = effectiveSuccessRate(model.parameters, 1, 0)

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
                <li>{formatSuccessPct(rate)} on 1 SP</li>
              </ul>
              <button
                type="button"
                className="btn btn--deploy"
                onClick={() => deployCloudAgent(model.id)}
                disabled={cash < model.deployCost}
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
        Racks: {servers.length}/{apt.rackSlots} · RAM: {usedRam.toFixed(1)}/{totalRam} GB · Agents: {agents.length}
      </p>
    </section>
  )
}
