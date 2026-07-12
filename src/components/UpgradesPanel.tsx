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
      <p
        className="hint"
        aria-label={`Unlocks hardware tiers. Currently: ${APARTMENT_CONFIG[apartment].label}`}
      >
        Unlocks hardware tiers. Currently: {APARTMENT_CONFIG[apartment].label}
      </p>
      {nextApt && (
        <button
          type="button"
          className="btn btn--deploy"
          aria-label={`Move to ${APARTMENT_CONFIG[nextApt].label} for $${APARTMENT_CONFIG[nextApt].upgradeCost}`}
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
          const upgradeSummary = [
            upgrade.label,
            `+${upgrade.ramGb} GB`,
            upgrade.tagline,
            owned ? 'owned' : unlocked ? `$${upgrade.cost}` : 'need better housing',
          ].join(', ')

          return (
            <article key={upgrade.id} className="vendor-card" aria-label={upgradeSummary}>
              <header>
                <h4>{upgrade.label}</h4>
                <span aria-label={`+${upgrade.ramGb} GB`}>+{upgrade.ramGb} GB</span>
              </header>
              <p className="vendor-tagline">{upgrade.tagline}</p>
              <button
                type="button"
                className="btn btn--small"
                aria-label={
                  owned
                    ? `${upgrade.label} owned`
                    : unlocked
                      ? `Buy ${upgrade.label} for $${upgrade.cost}`
                      : `${upgrade.label} requires better housing`
                }
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
          const upgradeSummary = [
            upgrade.label,
            `+${upgrade.gpus} GPU`,
            upgrade.tagline,
            owned ? 'owned' : unlocked ? `$${upgrade.cost}` : 'need better housing',
          ].join(', ')

          return (
            <article key={upgrade.id} className="vendor-card" aria-label={upgradeSummary}>
              <header>
                <h4>{upgrade.label}</h4>
                <span aria-label={`+${upgrade.gpus} GPU`}>+{upgrade.gpus} GPU</span>
              </header>
              <p className="vendor-tagline">{upgrade.tagline}</p>
              <button
                type="button"
                className="btn btn--small"
                aria-label={
                  owned
                    ? `${upgrade.label} owned`
                    : unlocked
                      ? `Buy ${upgrade.label} for $${upgrade.cost}`
                      : `${upgrade.label} requires better housing`
                }
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

  const modelSummary = [
    currentModel.displayName,
    `${currentModel.ramPerAgent} GB per agent`,
    currentModel.tagline,
    formatSpPerTick(currentModel.parameters, gameDay),
    `${currentModel.contextSize}k context`,
    nextModel ? `upgrade available to ${nextModel.displayName} for $${nextModel.upgradeCost}` : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="market-section">
      <article className="vendor-card" aria-label={modelSummary}>
        <header>
          <h4>{currentModel.displayName}</h4>
          <span aria-label={`${currentModel.ramPerAgent} GB per agent`}>
            {currentModel.ramPerAgent} GB/agent
          </span>
        </header>
        <p className="vendor-tagline">{currentModel.tagline}</p>
        <ul className="vendor-stats" aria-label="Model stats">
          <li>{formatSpPerTick(currentModel.parameters, gameDay)}</li>
          <li>{currentModel.contextSize}k context</li>
        </ul>
        {nextModel && (
          <button
            type="button"
            className="btn btn--deploy"
            aria-label={`Upgrade to ${nextModel.displayName} for $${nextModel.upgradeCost}`}
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
          const tuneSummary = [
            FINE_TUNE_LABELS[role],
            owned ? 'owned' : `$${FINE_TUNE_COST}`,
          ].join(', ')

          return (
            <article key={id} className="vendor-card vendor-card--compact" aria-label={tuneSummary}>
              <header>
                <h4>{FINE_TUNE_LABELS[role]}</h4>
              </header>
              <button
                type="button"
                className="btn btn--small"
                aria-label={
                  owned
                    ? `${FINE_TUNE_LABELS[role]} owned`
                    : `Buy ${FINE_TUNE_LABELS[role]} for $${FINE_TUNE_COST}`
                }
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
          const courseSummary = [
            course.label,
            course.tagline,
            course.description,
            owned ? 'enrolled' : `$${course.cost}`,
          ].join(', ')

          return (
            <article key={course.id} className="vendor-card" aria-label={courseSummary}>
              <header>
                <h4>{course.label}</h4>
              </header>
              <p className="vendor-tagline">"{course.tagline}"</p>
              <p className="hint">{course.description}</p>
              <button
                type="button"
                className="btn btn--small"
                aria-label={
                  owned
                    ? `${course.label} enrolled`
                    : `Enroll in ${course.label} for $${course.cost}`
                }
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
