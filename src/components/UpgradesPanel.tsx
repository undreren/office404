import { APARTMENT_CONFIG } from '../game/constants'
import { FINE_TUNE_COST, FINE_TUNE_LABELS, FINE_TUNE_ROLES, MODEL_TIERS, fineTuneId } from '../game/models'
import { canUpgradeModelTier, formatSpPerTick } from '../game/mechanics'
import { GPU_UPGRADES, getVisibleTrackUpgrades, housingMeetsRequirement, RAM_UPGRADES, VIBING_COURSES } from '../game/upgrades'
import { agentCapacity, getNextApartment, useGameStore } from '../game/store'

export function UpgradesPanel() {
  const state = useGameStore()
  const {
    cash,
    apartment,
    purchasedRamUpgrades,
    purchasedGpuUpgrades,
    purchasedFineTunes,
    vibingCourses,
    modelTierIndex,
  } = state
  const buyRamUpgrade = useGameStore((s) => s.buyRamUpgrade)
  const buyGpuUpgrade = useGameStore((s) => s.buyGpuUpgrade)
  const upgradeModelTier = useGameStore((s) => s.upgradeModelTier)
  const buyFineTune = useGameStore((s) => s.buyFineTune)
  const buyVibingCourse = useGameStore((s) => s.buyVibingCourse)
  const upgradeApartment = useGameStore((s) => s.upgradeApartment)

  const { totalRam } = agentCapacity(state)
  const currentModel = MODEL_TIERS[modelTierIndex]
  const nextModel = MODEL_TIERS[modelTierIndex + 1]
  const nextApt = getNextApartment({ apartment })
  const canModelUpgrade =
    nextModel &&
    cash >= nextModel.upgradeCost &&
    canUpgradeModelTier(totalRam, modelTierIndex)

  const visibleRamUpgrades = getVisibleTrackUpgrades(RAM_UPGRADES, purchasedRamUpgrades)
  const visibleGpuUpgrades = getVisibleTrackUpgrades(GPU_UPGRADES, purchasedGpuUpgrades)

  return (
    <section className="panel marketplace-panel">
      <h2>Upgrades</h2>

      <div className="market-section">
        <h3>Housing</h3>
        <p className="hint">Unlocks hardware tiers. Currently: {APARTMENT_CONFIG[apartment].label}</p>
        {nextApt && (
          <button
            type="button"
            className="btn btn--deploy"
            onClick={() => upgradeApartment()}
            disabled={cash < APARTMENT_CONFIG[nextApt].upgradeCost}
          >
            Move to {APARTMENT_CONFIG[nextApt].label} ($
            {APARTMENT_CONFIG[nextApt].upgradeCost})
          </button>
        )}
      </div>

      <div className="market-section">
        <h3>RAM Track</h3>
        <div className="vendor-list">
          {visibleRamUpgrades.map((upgrade) => {
            const owned = purchasedRamUpgrades.includes(upgrade.id)
            const unlocked = housingMeetsRequirement(apartment, upgrade.housingRequired)
            return (
              <article key={upgrade.id} className="vendor-card">
                <header>
                  <h4>{upgrade.label}</h4>
                  <span>+{upgrade.ramGb} GB</span>
                </header>
                <p className="vendor-tagline">{upgrade.tagline}</p>
                <button
                  type="button"
                  className="btn btn--small"
                  disabled={owned || !unlocked || cash < upgrade.cost}
                  onClick={() => buyRamUpgrade(upgrade.id)}
                >
                  {owned ? 'Owned' : unlocked ? `$${upgrade.cost}` : 'Need better housing'}
                </button>
              </article>
            )
          })}
        </div>
      </div>

      <div className="market-section">
        <h3>GPU Track</h3>
        <div className="vendor-list">
          {visibleGpuUpgrades.map((upgrade) => {
            const owned = purchasedGpuUpgrades.includes(upgrade.id)
            const unlocked = housingMeetsRequirement(apartment, upgrade.housingRequired)
            return (
              <article key={upgrade.id} className="vendor-card">
                <header>
                  <h4>{upgrade.label}</h4>
                  <span>+{upgrade.gpus} GPU</span>
                </header>
                <p className="vendor-tagline">{upgrade.tagline}</p>
                <button
                  type="button"
                  className="btn btn--small"
                  disabled={owned || !unlocked || cash < upgrade.cost}
                  onClick={() => buyGpuUpgrade(upgrade.id)}
                >
                  {owned ? 'Owned' : unlocked ? `$${upgrade.cost}` : 'Need better housing'}
                </button>
              </article>
            )
          })}
        </div>
      </div>

      <div className="market-section">
        <h3>Model Tier</h3>
        <article className="vendor-card">
          <header>
            <h4>{currentModel.displayName}</h4>
            <span>{currentModel.ramPerAgent} GB/agent</span>
          </header>
          <p className="vendor-tagline">{currentModel.tagline}</p>
          <ul className="vendor-stats">
            <li>{formatSpPerTick(currentModel.parameters)}</li>
            <li>{currentModel.contextSize}k context</li>
          </ul>
          {nextModel && (
            <button
              type="button"
              className="btn btn--deploy"
              disabled={!canModelUpgrade}
              onClick={() => upgradeModelTier()}
            >
              Upgrade to {nextModel.displayName} (${nextModel.upgradeCost})
            </button>
          )}
        </article>

        <h4>Fine-tunes (stackable)</h4>
        <div className="vendor-list">
          {FINE_TUNE_ROLES.map((role) => {
            const id = fineTuneId(modelTierIndex, role)
            const owned = purchasedFineTunes.includes(id)
            return (
              <article key={id} className="vendor-card vendor-card--compact">
                <header>
                  <h4>{FINE_TUNE_LABELS[role]}</h4>
                </header>
                <button
                  type="button"
                  className="btn btn--small"
                  disabled={owned || cash < FINE_TUNE_COST}
                  onClick={() => buyFineTune(id)}
                >
                  {owned ? 'Owned' : `$${FINE_TUNE_COST}`}
                </button>
              </article>
            )
          })}
        </div>
      </div>

      <div className="market-section">
        <h3>Vibing Courses</h3>
        <div className="vendor-list">
          {VIBING_COURSES.map((course) => {
            const owned = vibingCourses.includes(course.id)
            return (
              <article key={course.id} className="vendor-card">
                <header>
                  <h4>{course.label}</h4>
                </header>
                <p className="vendor-tagline">"{course.tagline}"</p>
                <p className="hint">{course.description}</p>
                <button
                  type="button"
                  className="btn btn--small"
                  disabled={owned || cash < course.cost}
                  onClick={() => buyVibingCourse(course.id)}
                >
                  {owned ? 'Enrolled' : `$${course.cost}`}
                </button>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
