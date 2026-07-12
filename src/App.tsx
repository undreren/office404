import { TabNavProvider, useTabNav } from './context/TabNavContext'
import { ResourceBar } from './components/ResourceBar'
import { BottomNav } from './components/BottomNav'
import { ProjectsPanel } from './components/ProjectsPanel'
import { LeadsPanel } from './components/LeadsPanel'
import { UpgradesPanel } from './components/UpgradesPanel'
import { AgentsPanel } from './components/AgentsPanel'
import { EventLog } from './components/EventLog'
import { GameOverlay } from './components/GameOverlay'
import { OnboardingOverlay } from './components/OnboardingOverlay'
import { GameRuntimeProvider, useGameRuntime } from './runtime/GameRuntime'

function AppShell() {
  const { activeTab } = useTabNav()

  return (
    <div className="app">
      <div className="scanlines" aria-hidden="true" />
      <ResourceBar compact={activeTab !== 'feed'} />
      <OnboardingOverlay />
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
      </main>

      <BottomNav />
    </div>
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
