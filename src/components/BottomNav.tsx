import { useTabNav, type TabId } from '../context/TabNavContext'
import { isReadyToDeliver } from '../game/selectors'
import { useGameState } from '../runtime/GameRuntime'

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'feed', icon: '📋', label: 'Feed' },
  { id: 'shop', icon: '🛒', label: 'Shop' },
  { id: 'agents', icon: '🤖', label: 'Agents' },
  { id: 'projects', icon: '📦', label: 'Projects' },
  { id: 'leads', icon: '📨', label: 'Leads' },
]

export function BottomNav() {
  const { activeTab, setActiveTab } = useTabNav()
  const { leads, projects } = useGameState()

  const availableLeads = leads.filter((l) => l.status === 'available').length
  const hasDeliverable = projects.some((p) => isReadyToDeliver(p))

  function badgeFor(tab: TabId): number | 'dot' | null {
    if (tab === 'leads' && availableLeads > 0) return availableLeads
    if (tab === 'projects' && hasDeliverable) return 'dot'
    return null
  }

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {TABS.map((tab) => {
        const badge = badgeFor(tab.id)
        return (
          <button
            key={tab.id}
            type="button"
            className={`bottom-nav__item ${activeTab === tab.id ? 'bottom-nav__item--active' : ''}`}
            aria-label={tab.label}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            onClick={() => setActiveTab(tab.id)}
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
