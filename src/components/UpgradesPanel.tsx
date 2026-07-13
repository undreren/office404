import type { ReactElement } from 'react'
import { HOUSING_CONFIG } from '../game/housing'
import { getHallucinationLevel } from '../game/meta'
import {
  FINE_TUNE_DESCRIPTIONS,
  FINE_TUNE_LABELS,
  FINE_TUNE_MAX_TIER,
  FINE_TUNE_ROLES,
  FINE_TUNE_TAGLINES,
  fineTuneCost,
  fineTuneId,
} from '../game/models'
import { formatCash } from '../game/cash'
import { getFineTuneLevel, gpuTickCost, maxAgentSlotPurchases, maxGpuTickPurchases, ramSlotCost } from '../game/mechanics'
import {
  buyAgentSlotMsg,
  buyFineTuneMsg,
  buyGpuTickMsg,
  buyVibingCourseMsg,
  upgradeApartmentMsg,
} from '../game/messages'
import { agentCapacity, getNextApartment } from '../game/selectors'
import { VIBING_COURSES, vibingCourseCost } from '../game/upgrades'
import { useGameDispatchPurchase, useGameState } from '../runtime/GameRuntime'
import { useTabNav } from '../context/TabNavContext'
import { SwipeCarousel } from './SwipeCarousel'

const SHOP_SECTIONS = [
  { id: 'housing', title: 'Housing', subtitle: 'Rent is just a suggestion until the landlord disagrees.' },
  {
    id: 'metaface',
    title: 'MetaFace Marketspace',
    subtitle: 'RAM, tensor cores, and role-specific fine-tunes. All ethically sourced from a Discord.',
  },
  {
    id: 'courses',
    title: 'Vibing Courses',
    subtitle: 'Professional development for professionals who develop unprofessionally.',
  },
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

function MetaFaceMarketspaceSection() {
  const state = useGameState()
  const { cash, apartment, agentSlotPurchases, gpuTickPurchases, purchasedFineTunes, fineTuneTiers, meta } = state
  const dispatchPurchase = useGameDispatchPurchase()
  const { agentSlots, gpuTicks } = agentCapacity(state)
  const maxRamPurchases = maxAgentSlotPurchases(apartment)
  const maxGpuPurchases = maxGpuTickPurchases(apartment)
  const ramAtMax = agentSlotPurchases >= maxRamPurchases
  const gpuAtMax = gpuTickPurchases >= maxGpuPurchases
  const ramCost = ramSlotCost(agentSlotPurchases)
  const gpuCost = gpuTickCost(gpuTickPurchases)
  const modelLevel = getHallucinationLevel(meta, 'model')

  return (
    <div className="market-section">
      <p className="hint" aria-label={`${agentSlots} agent slots and ${gpuTicks} GPU ticks`}>
        {agentSlots} agent slot{agentSlots === 1 ? '' : 's'} · {gpuTicks} GPU tick
        {gpuTicks === 1 ? '' : 's'} shared across active workers.
      </p>

      <div className="vendor-list">
        <article className="vendor-card" aria-label={`+1 agent slot for ${formatCash(ramCost)}`}>
          <header>
            <h4>+1 Agent Slot</h4>
            <span>{agentSlots} total</span>
          </header>
          <p className="vendor-tagline">HR calls it headcount. You call it hope.</p>
          <p className="hint">More seats on the roster. Housing caps how many you can buy.</p>
          <button
            type="button"
            className="btn btn--small"
            aria-label={
              ramAtMax ? 'Agent slot purchases maxed for housing' : `Buy +1 agent slot for ${formatCash(ramCost)}`
            }
            disabled={ramAtMax || cash < ramCost}
            onClick={() => dispatchPurchase(buyAgentSlotMsg(Date.now()))}
          >
            {ramAtMax ? 'Housing maxed' : formatCash(ramCost)}
          </button>
        </article>

        <article className="vendor-card" aria-label={`+1 GPU tick for ${formatCash(gpuCost)}`}>
          <header>
            <h4>+1 GPU Tick</h4>
            <span>{gpuTicks} total</span>
          </header>
          <p className="vendor-tagline">Fans spin. Morale does not.</p>
          <p className="hint">More ticks per second split across every agent burning GPU time.</p>
          <button
            type="button"
            className="btn btn--small"
            aria-label={
              gpuAtMax ? 'GPU tick purchases maxed for housing' : `Buy +1 GPU tick for ${formatCash(gpuCost)}`
            }
            disabled={gpuAtMax || cash < gpuCost}
            onClick={() => dispatchPurchase(buyGpuTickMsg(Date.now()))}
          >
            {gpuAtMax ? 'Housing maxed' : formatCash(gpuCost)}
          </button>
        </article>
      </div>

      <h4 className="shop-section__subhead">Fine-tunes (tiered)</h4>
      <p className="hint">Role-specific tuning for your current prestige model tier. Each level costs more; model tier upgrades live in Hallucinations.</p>
      <div className="vendor-list">
        {FINE_TUNE_ROLES.map((role) => {
          const id = fineTuneId(modelLevel, role)
          const currentTier = getFineTuneLevel(fineTuneTiers, purchasedFineTunes, id)
          const maxed = currentTier >= FINE_TUNE_MAX_TIER
          const cost = fineTuneCost(currentTier)
          const tuneSummary = [
            FINE_TUNE_LABELS[role],
            FINE_TUNE_TAGLINES[role],
            maxed ? `max tier T${FINE_TUNE_MAX_TIER}` : formatCash(cost),
          ].join(', ')

          return (
            <article key={id} className="vendor-card vendor-card--compact" aria-label={tuneSummary}>
              <header>
                <h4>
                  {FINE_TUNE_LABELS[role]}
                  <span className="vendor-tier" aria-label={`Tier ${currentTier} of ${FINE_TUNE_MAX_TIER}`}>
                    {' '}
                    · T{currentTier}/{FINE_TUNE_MAX_TIER}
                  </span>
                </h4>
              </header>
              <p className="vendor-tagline">&ldquo;{FINE_TUNE_TAGLINES[role]}&rdquo;</p>
              <p className="hint">{FINE_TUNE_DESCRIPTIONS[role]}</p>
              <button
                type="button"
                className="btn btn--small"
                aria-label={
                  maxed
                    ? `${FINE_TUNE_LABELS[role]} at max tier`
                    : `Buy ${FINE_TUNE_LABELS[role]} T${currentTier + 1} for ${formatCash(cost)}`
                }
                disabled={maxed || cash < cost}
                onClick={() => dispatchPurchase(buyFineTuneMsg(Date.now(), id))}
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
  metaface: MetaFaceMarketspaceSection,
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
