import { ResourceBar } from './components/ResourceBar'
import { SprintPanel } from './components/SprintPanel'
import { DeployPanel } from './components/DeployPanel'
import { ServerRack } from './components/ServerRack'
import { EventLog } from './components/EventLog'
import { useGameTick, useOfflineProgress } from './hooks/useGameTick'

function App() {
  useGameTick()
  useOfflineProgress()

  return (
    <div className="app">
      <div className="scanlines" aria-hidden="true" />
      <ResourceBar />

      <main className="main">
        <SprintPanel />
        <ServerRack />
        <DeployPanel />
        <EventLog />
      </main>

      <footer className="footer">
        <p>One-man agency · Infinite deadlines · Questionable architecture</p>
      </footer>
    </div>
  )
}

export default App
