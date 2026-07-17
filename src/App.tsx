import { TabNavProvider, useTabNav } from './context/TabNavContext'
import { ResourceBar } from './components/ResourceBar'
import { BottomNav } from './components/BottomNav'
import { ProjectsPanel } from './components/ProjectsPanel'
import { ProductPanel } from './components/ProductPanel'
import { UpgradesPanel } from './components/UpgradesPanel'
import { StatusPanel } from './components/StatusPanel'
import { HallucinationsPanel } from './components/HallucinationsPanel'
import { GameOverlay } from './components/GameOverlay'
import { OnboardingOverlay } from './components/OnboardingOverlay'
import { useOnboardingModal } from './hooks/useOnboardingModal'
import { GameRuntimeProvider, useGameRuntime } from './runtime/GameRuntime'

function AppShell() {
  const { activeTab } = useTabNav()
  const onboardingModal = useOnboardingModal()
  const modalOpen = onboardingModal !== null

  return (
    <>
      <div className="app" aria-hidden={modalOpen || undefined} inert={modalOpen || undefined}>
        <div className="scanlines" aria-hidden="true" />
        <ResourceBar compact={activeTab !== 'status'} />
        <GameOverlay />

        <main className="main">
          <div className={`tab-view ${activeTab === 'status' ? 'tab-view--active' : ''}`}>
            <StatusPanel />
          </div>
          <div className={`tab-view ${activeTab === 'shop' ? 'tab-view--active' : ''}`}>
            <UpgradesPanel />
          </div>
          <div className={`tab-view ${activeTab === 'projects' ? 'tab-view--active' : ''}`}>
            <ProjectsPanel />
          </div>
          <div className={`tab-view ${activeTab === 'product' ? 'tab-view--active' : ''}`}>
            <ProductPanel />
          </div>
          <div className={`tab-view ${activeTab === 'hallucinations' ? 'tab-view--active' : ''}`}>
            <HallucinationsPanel />
          </div>
        </main>

        <BottomNav />
      </div>
      <OnboardingOverlay />
    </>
  )
}

function HydratedApp() {
  const { hydrated, catchingUp } = useGameRuntime()

  if (!hydrated) {
    return (
      <div className="app app--booting">
        <div className="scanlines" aria-hidden="true" />
        <p className="hydration-loading">
          {catchingUp ? 'Catching up while you were away…' : 'Loading save…'}
        </p>
      </div>
    )
  }

  if (catchingUp) {
    return (
      <div className="app app--booting">
        <div className="scanlines" aria-hidden="true" />
        <p className="hydration-loading">Catching up while you were away…</p>
      </div>
    )
  }

  return (
    <TabNavProvider>
      <AppShell />
    </TabNavProvider>
  )
}

function App() {
  return (
    <GameRuntimeProvider>
      <HydratedApp />
    </GameRuntimeProvider>
  )
}

export default App
