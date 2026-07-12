import type { ReactElement } from 'react'
import { APARTMENT_CONFIG } from '../game/constants'
import { FINE_TUNE_COST, FINE_TUNE_LABELS, FINE_TUNE_ROLES, MODEL_TIERS, fineTuneId } from '../game/models'
import { canUpgradeModelTier, formatSpPerTick } from '../game/mechanics'
import {
  buyFineTuneMsg,
  buyGpuUpgradeMsg,
  buyRamUpgradeMsg,
  buyVibingCourseMsg,
  upgradeApartmentMsg,
  upgradeModelTierMsg,
} from '../game/messages'
import { agentCapacity, getNextApartment } from '../game/selectors'
import { GPU_UPGRADES, getVisibleTrackUpgrades, housingMeetsRequirement, RAM_UPGRADES, VIBING_COURSES } from '../game/upgrades'
import { useGameDispatchPurchase, useGameState } from '../runtime/GameRuntime'
import { useTabNav } from '../context/TabNavContext'
import { SwipeCarousel } from './SwipeCarousel'

const SHOP_SECTIONS = [
  { id: 'housing', title: 'Housing', subtitle: 'Rent is just a suggestion until the landlord disagrees.' },
  { id: 'ram', title: 'RAM Track', subtitle: 'Your agents forget everything. This helps them forget faster.' },
  { id: 'gpu', title: 'GPU Track', subtitle: 'More tensor cores, fewer existential crises.' },
  { id: 'model', title: 'Model Tier', subtitle: 'Bigger brains, smaller excuses.' },
  { id: 'courses', title: 'Vibing Courses', subtitle: 'Professional development for professionals who develop unprofessionally.' },
] as const

type ShopSectionId = (typeof SHOP_SECTIONS)[number]['id']

function HousingSection() {
  const { cash, apartment } = useGameState()
  const dispatchPurchase = useGameDispatchPurchase()
  const nextApt = getNextApartment({ apartment })

  return (
    <div className="market-section">
      <p className="hint">Unlocks hardware tiers. Currently: {APARTMENT_CONFIG[apartment].label}</p>
      {nextApt && (
        <button
          type="button"
          className="btn btn--deploy"
          onClick={() => dispatchPurchase(upgradeApartmentMsg(Date.now()))}
          disabled={cash < APARTMENT_CONFIG[nextApt].upgradeCost}
        >
          Move to {APARTMENT_CONFIG[nextApt].label} (${APARTMENT_CONFIG[nextApt].upgradeCost})
        </button>
      )}
    </div>
  )
}

function RamSection() {
  const { cash, apartment, purchasedRamUpgrades } = useGameState()
  const dispatchPurchase = useGameDispatchPurchase()
  const visibleRamUpgrades = getVisibleTrackUpgrades(RAM_UPGRADES, purchasedRamUpgrades)

  return (
    <div className="market-section">
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
                onClick={() => dispatchPurchase(buyRamUpgradeMsg(Date.now(), upgrade.id))}
              >
                {owned ? 'Owned' : unlocked ? `$${upgrade.cost}` : 'Need better housing'}
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function GpuSection() {
  const { cash, apartment, purchasedGpuUpgrades } = useGameState()
  const dispatchPurchase = useGameDispatchPurchase()
  const visibleGpuUpgrades = getVisibleTrackUpgrades(GPU_UPGRADES, purchasedGpuUpgrades)

  return (
    <div className="market-section">
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
                onClick={() => dispatchPurchase(buyGpuUpgradeMsg(Date.now(), upgrade.id))}
              >
                {owned ? 'Owned' : unlocked ? `$${upgrade.cost}` : 'Need better housing'}
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function ModelSection() {
  const state = useGameState()
  const { cash, gameDay, modelTierIndex, purchasedFineTunes } = state
  const dispatchPurchase = useGameDispatchPurchase()
  const { totalRam } = agentCapacity(state)
  const currentModel = MODEL_TIERS[modelTierIndex]
  const nextModel = MODEL_TIERS[modelTierIndex + 1]
  const canModelUpgrade =
    nextModel &&
    cash >= nextModel.upgradeCost &&
    canUpgradeModelTier(totalRam, modelTierIndex)

  return (
    <div className="market-section">
      <article className="vendor-card">
        <header>
          <h4>{currentModel.displayName}</h4>
          <span>{currentModel.ramPerAgent} GB/agent</span>
        </header>
        <p className="vendor-tagline">{currentModel.tagline}</p>
        <ul className="vendor-stats">
          <li>{formatSpPerTick(currentModel.parameters, gameDay)}</li>
          <li>{currentModel.contextSize}k context</li>
        </ul>
        {nextModel && (
          <button
            type="button"
            className="btn btn--deploy"
            disabled={!canModelUpgrade}
            onClick={() => dispatchPurchase(upgradeModelTierMsg(Date.now()))}
          >
            Upgrade to {nextModel.displayName} (${nextModel.upgradeCost})
          </button>
        )}
      </article>

      <h4 className="shop-section__subhead">Fine-tunes (stackable)</h4>
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
                onClick={() => dispatchPurchase(buyFineTuneMsg(Date.now(), id))}
              >
                {owned ? 'Owned' : `$${FINE_TUNE_COST}`}
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function CoursesSection() {
  const { cash, vibingCourses } = useGameState()
  const dispatchPurchase = useGameDispatchPurchase()

  return (
    <div className="market-section">
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
                onClick={() => dispatchPurchase(buyVibingCourseMsg(Date.now(), course.id))}
              >
                {owned ? 'Enrolled' : `$${course.cost}`}
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}

const SECTION_CONTENT: Record<ShopSectionId, () => ReactElement> = {
  housing: HousingSection,
  ram: RamSection,
  gpu: GpuSection,
  model: ModelSection,
  courses: CoursesSection,
}

export function UpgradesPanel() {
  const { shopIndex, setShopIndex } = useTabNav()

  return (
    <SwipeCarousel
      index={shopIndex}
      onIndexChange={setShopIndex}
      headers={SHOP_SECTIONS.map((s) => ({ title: s.title, subtitle: s.subtitle }))}
      panelClassName="marketplace-panel"
      slides={SHOP_SECTIONS.map((section) => {
        const SectionContent = SECTION_CONTENT[section.id]
        return <SectionContent key={section.id} />
      })}
    />
  )
}
