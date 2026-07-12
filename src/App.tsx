import { useEffect, useState } from 'react'
import { TabNavProvider, useTabNav } from './context/TabNavContext'
import { ResourceBar } from './components/ResourceBar'
import { BottomNav } from './components/BottomNav'
import { ProjectsPanel } from './components/ProjectsPanel'
import { LeadsPanel } from './components/LeadsPanel'
import { UpgradesPanel } from './components/UpgradesPanel'
import { AgentsPanel } from './components/AgentsPanel'
import { EventLog } from './components/EventLog'
import { GameOverlay } from './components/GameOverlay'
import { useGameStore } from './game/store'
import { useGameTick } from './hooks/useGameTick'

function AppShell() {
  const { activeTab } = useTabNav()

  return (
    <div className="app">
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
      </main>

      <BottomNav />
    </div>
  )
}

function App() {
  const [hydrated, setHydrated] = useState(() => useGameStore.persist.hasHydrated())

  useEffect(() => {
    return useGameStore.persist.onFinishHydration(() => setHydrated(true))
  }, [])

  useGameTick(hydrated)

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

export default App
