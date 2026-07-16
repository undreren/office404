import { useTabNav, type TabId } from '../context/TabNavContext'
import { isReadyToDeliver } from '../game/selectors'
import { canAccessProduct } from '../game/product'
import { useGameState } from '../runtime/GameRuntime'

const BASE_TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'status', icon: '📊', label: 'Status' },
  { id: 'shop', icon: '🛒', label: 'Shop' },
  { id: 'projects', icon: '📦', label: 'Projects' },
]

const PRODUCT_TAB = { id: 'product' as const, icon: '🏗️', label: 'Product' }

const HALLUCINATIONS_TAB = { id: 'hallucinations' as const, icon: '✨', label: 'Hallucinations' }

export function BottomNav() {
  const { activeTab, setActiveTab } = useTabNav()
  const { leads, projects, tutorialDone, meta } = useGameState()

  const tabs = [
    ...BASE_TABS,
    ...(canAccessProduct(meta) ? [PRODUCT_TAB] : []),
    HALLUCINATIONS_TAB,
  ]

  const availableLeads = leads.filter((l) => l.status === 'available').length
  const hasDeliverable = projects.some((p) => isReadyToDeliver(p))

  function badgeFor(tab: TabId): number | 'dot' | null {
    if (tab === 'projects' && availableLeads > 0) return availableLeads
    if (tab === 'projects' && hasDeliverable) return 'dot'
    return null
  }

  function isLocked(tab: TabId): boolean {
    return !tutorialDone && tab !== 'projects'
  }

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {tabs.map((tab) => {
        const badge = badgeFor(tab.id)
        const locked = isLocked(tab.id)
        return (
          <button
            key={tab.id}
            type="button"
            className={`bottom-nav__item ${activeTab === tab.id ? 'bottom-nav__item--active' : ''} ${locked ? 'bottom-nav__item--locked' : ''}`}
            aria-label={locked ? `${tab.label} (locked until tutorial complete)` : tab.label}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            aria-disabled={locked || undefined}
            disabled={locked}
            onClick={() => {
              if (!locked) setActiveTab(tab.id)
            }}
          >
            <span className="bottom-nav__icon" aria-hidden="true">
              {tab.icon}
            </span>
            {badge === 'dot' && <span className="bottom-nav__badge bottom-nav__badge--dot" />}
            {typeof badge === 'number' && (
              <span className="bottom-nav__badge">{badge > 9 ? '9+' : badge}</span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
