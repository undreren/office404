import { useGameStore } from '../game/store'

export function LeadsPanel() {
  const leads = useGameStore((s) => s.leads)
  const reputation = useGameStore((s) => s.reputation)
  const projects = useGameStore((s) => s.projects)
  const acceptLead = useGameStore((s) => s.acceptLead)
  const rejectLead = useGameStore((s) => s.rejectLead)

  const available = leads.filter((l) => l.status === 'available')

  return (
    <section className="panel leads-panel">
      <h2>Client Leads</h2>
      <p className="hint">Accept the pain. Reject professionally. Let expire for shame.</p>

      {available.length === 0 && <p className="empty-slot">No leads right now. Check back after more suffering.</p>}

      {available.map((lead) => {
        const canAccept = reputation >= lead.repRequired && projects.length < 4
        return (
          <article key={lead.id} className="lead-card">
            <header>
              <h3>{lead.clientName}</h3>
              <span className={lead.daysToExpire < 2 ? 'text-danger' : ''}>
                {Math.ceil(lead.daysToExpire)}d to respond
              </span>
            </header>
            {lead.clientTagline && <p className="client-tagline">"{lead.clientTagline}"</p>}
            <p>{lead.blurb}</p>
            <ul className="lead-stats">
              <li>{lead.totalStoryPoints} SP total</li>
              <li>{lead.durationDays} day deadline</li>
              <li>${lead.payment} on completion</li>
              {lead.repRequired > 0 && <li>{lead.repRequired} rep required</li>}
            </ul>
            <div className="action-row">
              <button type="button" className="btn btn--deploy" onClick={() => acceptLead(lead.id)} disabled={!canAccept}>
                Accept
              </button>
              <button type="button" className="btn btn--small" onClick={() => rejectLead(lead.id)}>
                Reject
              </button>
            </div>
          </article>
        )
      })}
    </section>
  )
}
