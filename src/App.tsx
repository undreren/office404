import { ResourceBar } from './components/ResourceBar'
import { PlayerActionsPanel } from './components/PlayerActionsPanel'
import { ProjectsPanel } from './components/ProjectsPanel'
import { LeadsPanel } from './components/LeadsPanel'
import { MarketplacePanel } from './components/MarketplacePanel'
import { ServerRack } from './components/ServerRack'
import { EventLog } from './components/EventLog'
import { GameOverlay } from './components/GameOverlay'
import { useGameTick } from './hooks/useGameTick'

function App() {
  useGameTick()

  return (
    <div className="app">
      <div className="scanlines" aria-hidden="true" />
      <ResourceBar />
      <GameOverlay />

      <main className="main">
        <PlayerActionsPanel />
        <ProjectsPanel />
        <LeadsPanel />
        <ServerRack />
        <MarketplacePanel />
        <EventLog />
      </main>

      <footer className="footer">
        <p>Solo freelance · Multiple deadlines · Questionable merges</p>
      </footer>
    </div>
  )
}

export default App
