import type { ReactElement } from 'react'
import { HOUSING_CONFIG } from '../game/housing'
import { getHallucinationLevel } from '../game/meta'
import { FINE_TUNE_COST, FINE_TUNE_LABELS, FINE_TUNE_ROLES, MODEL_TIERS, fineTuneId } from '../game/models'
import { formatSpPerTick } from '../game/mechanics'
import { effectiveModelParams } from '../game/prestige'
import {
  buyAgentSlotMsg,
  buyFineTuneMsg,
  buyGpuTickMsg,
  buyVibingCourseMsg,
  upgradeApartmentMsg,
} from '../game/messages'
import { agentCapacity, getNextApartment } from '../game/selectors'
import { formatCash } from '../game/cash'
import { gpuTickCost, maxAgentSlotPurchases, maxGpuTickPurchases, ramSlotCost } from '../game/mechanics'
import { VIBING_COURSES, vibingCourseCost } from '../game/upgrades'
import { useGameDispatchPurchase, useGameState } from '../runtime/GameRuntime'
import { useTabNav } from '../context/TabNavContext'
import { SwipeCarousel } from './SwipeCarousel'

const SHOP_SECTIONS = [
  { id: 'housing', title: 'Housing', subtitle: 'Rent is just a suggestion until the landlord disagrees.' },
  { id: 'agentSlots', title: 'Agent Slots', subtitle: 'More seats at the table. Same amount of regret.' },
  { id: 'gpuTicks', title: 'GPU Ticks', subtitle: 'More tensor cores, fewer existential crises.' },
  { id: 'model', title: 'Model Tier', subtitle: 'Prestige hallucinations only. Cash cannot buy bigger brains.' },
  { id: 'courses', title: 'Vibing Courses', subtitle: 'Professional development for professionals who develop unprofessionally.' },
] as const

type ShopSectionId = (typeof SHOP_SECTIONS)[number]['id']

function HousingSection() {
  const { cash, apartment } = useGameState()
  const dispatchPurchase = useGameDispatchPurchase()
  const nextApt = getNextApartment({ apartment })
  const housing = HOUSING_CONFIG[apartment]

  return (
    <div className="market-section">
      <p
        className="hint"
        aria-label={`Unlocks hardware tiers. Currently: ${housing.label}`}
      >
        Unlocks hardware tiers. Currently: {housing.label}
      </p>
      {nextApt && (
        <button
          type="button"
          className="btn btn--deploy"
          aria-label={`Move to ${HOUSING_CONFIG[nextApt].label} for ${formatCash(HOUSING_CONFIG[nextApt].upgradeCost)}`}
          onClick={() => dispatchPurchase(upgradeApartmentMsg(Date.now()))}
          disabled={cash < HOUSING_CONFIG[nextApt].upgradeCost}
        >
          Move to {HOUSING_CONFIG[nextApt].label} ({formatCash(HOUSING_CONFIG[nextApt].upgradeCost)})
        </button>
      )}
    </div>
  )
}

function AgentSlotsSection() {
  const state = useGameState()
  const { cash, apartment, agentSlotPurchases } = state
  const dispatchPurchase = useGameDispatchPurchase()
  const { agentSlots } = agentCapacity(state)
  const maxPurchases = maxAgentSlotPurchases(apartment)
  const atMax = agentSlotPurchases >= maxPurchases
  const cost = ramSlotCost(agentSlotPurchases)

  return (
    <div className="market-section">
      <p className="hint" aria-label={`${agentSlots} agent slots total`}>
        {agentSlots} agent slot{agentSlots === 1 ? '' : 's'} staffed max. Housing caps purchases.
      </p>
      <article className="vendor-card" aria-label={`+1 agent slot for ${formatCash(cost)}`}>
        <header>
          <h4>+1 Agent Slot</h4>
          <span>{agentSlots} total</span>
        </header>
        <p className="vendor-tagline">HR calls it headcount. You call it hope.</p>
        <button
          type="button"
          className="btn btn--small"
          aria-label={atMax ? 'Agent slot purchases maxed for housing' : `Buy +1 agent slot for ${formatCash(cost)}`}
          disabled={atMax || cash < cost}
          onClick={() => dispatchPurchase(buyAgentSlotMsg(Date.now()))}
        >
          {atMax ? 'Housing maxed' : formatCash(cost)}
        </button>
      </article>
    </div>
  )
}

function GpuTicksSection() {
  const state = useGameState()
  const { cash, apartment, gpuTickPurchases } = state
  const dispatchPurchase = useGameDispatchPurchase()
  const { gpuTicks } = agentCapacity(state)
  const maxPurchases = maxGpuTickPurchases(apartment)
  const atMax = gpuTickPurchases >= maxPurchases
  const cost = gpuTickCost(gpuTickPurchases)

  return (
    <div className="market-section">
      <p className="hint" aria-label={`${gpuTicks} GPU ticks total`}>
        {gpuTicks} GPU tick{gpuTicks === 1 ? '' : 's'} shared across active coders.
      </p>
      <article className="vendor-card" aria-label={`+1 GPU tick for ${formatCash(cost)}`}>
        <header>
          <h4>+1 GPU Tick</h4>
          <span>{gpuTicks} total</span>
        </header>
        <p className="vendor-tagline">Fans spin. Morale does not.</p>
        <button
          type="button"
          className="btn btn--small"
          aria-label={atMax ? 'GPU tick purchases maxed for housing' : `Buy +1 GPU tick for ${formatCash(cost)}`}
          disabled={atMax || cash < cost}
          onClick={() => dispatchPurchase(buyGpuTickMsg(Date.now()))}
        >
          {atMax ? 'Housing maxed' : formatCash(cost)}
        </button>
      </article>
    </div>
  )
}

function ModelSection() {
  const state = useGameState()
  const { cash, gameDay, purchasedFineTunes, meta } = state
  const dispatchPurchase = useGameDispatchPurchase()
  const modelLevel = getHallucinationLevel(meta, 'model')
  const currentModel = MODEL_TIERS[Math.min(modelLevel, MODEL_TIERS.length - 1)]!
  const effectiveParams = effectiveModelParams(meta)

  const modelSummary = [
    currentModel.displayName,
    `prestige level ${modelLevel}`,
    currentModel.tagline,
    formatSpPerTick(effectiveParams, gameDay),
    `${currentModel.contextSize}k context`,
    'upgrade via Hallucinations tab',
  ].join(', ')

  return (
    <div className="market-section">
      <article className="vendor-card" aria-label={modelSummary}>
        <header>
          <h4>{currentModel.displayName}</h4>
          <span aria-label={`Prestige model level ${modelLevel}`}>Lv {modelLevel}</span>
        </header>
        <p className="vendor-tagline">{currentModel.tagline}</p>
        <ul className="vendor-stats" aria-label="Model stats">
          <li>{formatSpPerTick(effectiveParams, gameDay)}</li>
          <li>{currentModel.contextSize}k context</li>
        </ul>
        <p className="hint">Model tier upgrades live in the Hallucinations shop — spend points from retirement.</p>
      </article>

      <h4 className="shop-section__subhead">Fine-tunes (stackable)</h4>
      <div className="vendor-list">
        {FINE_TUNE_ROLES.map((role) => {
          const id = fineTuneId(modelLevel, role)
          const owned = purchasedFineTunes.includes(id)
          const tuneSummary = [FINE_TUNE_LABELS[role], owned ? 'owned' : formatCash(FINE_TUNE_COST)].join(', ')

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
                    : `Buy ${FINE_TUNE_LABELS[role]} for ${formatCash(FINE_TUNE_COST)}`
                }
                disabled={owned || cash < FINE_TUNE_COST}
                onClick={() => dispatchPurchase(buyFineTuneMsg(Date.now(), id))}
              >
                {owned ? 'Owned' : formatCash(FINE_TUNE_COST)}
              </button>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function CoursesSection() {
  const { cash, vibingCourses, vibingCourseTiers } = useGameState()
  const dispatchPurchase = useGameDispatchPurchase()

  return (
    <div className="market-section">
      <div className="vendor-list">
        {VIBING_COURSES.map((course) => {
          const currentTier =
            vibingCourseTiers[course.id] ?? (vibingCourses.includes(course.id) ? 1 : 0)
          const maxTier = course.maxTier ?? 1
          const maxed = currentTier >= maxTier
          const cost = vibingCourseCost(course, currentTier)
          const tierLabel = maxTier > 1 ? ` tier ${currentTier}/${maxTier}` : ''
          const courseSummary = [
            course.label,
            course.tagline,
            course.description,
            maxed ? 'max tier' : formatCash(cost),
          ].join(', ')

          return (
            <article key={course.id} className="vendor-card" aria-label={courseSummary}>
              <header>
                <h4>
                  {course.label}
                  {maxTier > 1 && (
                    <span className="vendor-tier" aria-label={`Tier ${currentTier} of ${maxTier}`}>
                      {' '}
                      · T{currentTier}/{maxTier}
                    </span>
                  )}
                </h4>
              </header>
              <p className="vendor-tagline">&ldquo;{course.tagline}&rdquo;</p>
              <p className="hint">{course.description}</p>
              <button
                type="button"
                className="btn btn--small"
                aria-label={
                  maxed
                    ? `${course.label} at max tier`
                    : `Enroll in ${course.label}${tierLabel} for ${formatCash(cost)}`
                }
                disabled={maxed || cash < cost}
                onClick={() => dispatchPurchase(buyVibingCourseMsg(Date.now(), course.id))}
              >
                {maxed ? 'Max tier' : formatCash(cost)}
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
  agentSlots: AgentSlotsSection,
  gpuTicks: GpuTicksSection,
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
