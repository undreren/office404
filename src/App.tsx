import { TabNavProvider, useTabNav } from './context/TabNavContext'
import { ResourceBar } from './components/ResourceBar'
import { BottomNav } from './components/BottomNav'
import { ProjectsPanel } from './components/ProjectsPanel'
import { LeadsPanel } from './components/LeadsPanel'
import { UpgradesPanel } from './components/UpgradesPanel'
import { AgentsPanel } from './components/AgentsPanel'
import { HallucinationsPanel } from './components/HallucinationsPanel'
import { EventLog } from './components/EventLog'
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
        <ResourceBar compact={activeTab !== 'feed'} />
        <GameOverlay />

        <main className="main">
          <div className={`tab-view ${activeTab === 'feed' ? 'tab-view--active' : ''}`}>
            <EventLog />
          </div>
          <div className={`tab-view ${activeTab === 'shop' ? 'tab-view--active' : ''}`}>
            <UpgradesPanel />
          </div>
          <div className={`tab-view ${activeTab === 'agents' ? 'tab-view--active' : ''}`}>
            <AgentsPanel />
          </div>
          <div className={`tab-view ${activeTab === 'projects' ? 'tab-view--active' : ''}`}>
            <ProjectsPanel />
          </div>
          <div className={`tab-view ${activeTab === 'leads' ? 'tab-view--active' : ''}`}>
            <LeadsPanel />
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
  const { hydrated } = useGameRuntime()

  if (!hydrated) {
    return (
      <div className="app">
        <div className="scanlines" aria-hidden="true" />
        <p className="hydration-loading">Loading save…</p>
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
