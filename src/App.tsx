import { useEffect, useState } from 'react'
import { ResourceBar } from './components/ResourceBar'
import { ProjectsPanel } from './components/ProjectsPanel'
import { LeadsPanel } from './components/LeadsPanel'
import { UpgradesPanel } from './components/UpgradesPanel'
import { AgentsPanel } from './components/AgentsPanel'
import { EventLog } from './components/EventLog'
import { GameOverlay } from './components/GameOverlay'
import { useGameStore } from './game/store'
import { useGameTick } from './hooks/useGameTick'

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
    <div className="app">
      <div className="scanlines" aria-hidden="true" />
      <ResourceBar />
      <GameOverlay />

      <main className="main">
        <ProjectsPanel />
        <LeadsPanel />
        <AgentsPanel />
        <UpgradesPanel />
        <EventLog />
      </main>

      <footer className="footer">
        <p>Solo freelance · Agents do the work · You vibe</p>
      </footer>
    </div>
  )
}

export default App
