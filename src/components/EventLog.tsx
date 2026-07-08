import { useGameStore } from '../game/store'

const EVENT_ICONS: Record<string, string> = {
  crash: '💥',
  fire: '🔥',
  client: '📧',
  token_hike: '📈',
  awareness: '🪞',
  milestone: '🚀',
  system: '⚙️',
}

export function EventLog() {
  const events = useGameStore((s) => s.events)

  return (
    <section className="panel event-log">
      <h2>Incident Feed</h2>
      <ul className="event-list">
        {events.map((event) => (
          <li key={event.id} className={`event event--${event.type}`}>
            <span className="event__icon">{EVENT_ICONS[event.type] ?? '•'}</span>
            <span className="event__message">{event.message}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
