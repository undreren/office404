import { useTabNav } from '../context/TabNavContext'
import { rejectLeadMsg } from '../game/messages'
import { effectiveLeadDuration } from '../game/projects'
import { useGameDispatchAt, useGameState } from '../runtime/GameRuntime'

export function LeadsPanel() {
  const { leads, reputation, gameDay, projects, tutorialDone } = useGameState()
  const { acceptLead } = useTabNav()
  const dispatchAt = useGameDispatchAt()

  const available = leads.filter((l) => l.status === 'available')

  return (
    <section className="panel leads-panel">
      <h2>Leads</h2>
      <p className="panel__subtitle">Accept the pain. Reject professionally. Let expire for shame.</p>

      {available.length === 0 && (
        <p
          className="empty-slot"
          aria-label={
            !tutorialDone
              ? 'Finish your first project to unlock leads.'
              : 'No leads right now. Check back after more suffering.'
          }
        >
          {!tutorialDone
            ? 'Finish your first project to unlock leads.'
            : 'No leads right now. Check back after more suffering.'}
        </p>
      )}

      {available.map((lead) => {
        const canAccept = reputation >= lead.repRequired && projects.length < 4
        const effectiveDays = effectiveLeadDuration(lead, gameDay)
        const waitPenalty = lead.durationDays - effectiveDays
        const leadSummary = [
          lead.clientName,
          `${Math.ceil(lead.daysToExpire)} days to respond`,
          `${effectiveDays} day deadline`,
          waitPenalty > 0 ? `minus ${waitPenalty} days for waiting` : null,
          `$${lead.payment} on completion`,
          `${lead.totalStoryPoints} story points total`,
          lead.repRequired > 0 ? `${lead.repRequired} rep required` : null,
          canAccept ? 'can accept' : 'cannot accept',
        ]
          .filter(Boolean)
          .join(', ')

        return (
          <article key={lead.id} className="lead-card" aria-label={leadSummary}>
            <header>
              <h3>{lead.clientName}</h3>
              <span
                className={lead.daysToExpire < 2 ? 'text-danger' : ''}
                aria-label={`${Math.ceil(lead.daysToExpire)} days to respond`}
              >
                {Math.ceil(lead.daysToExpire)}d to respond
              </span>
            </header>
            {lead.clientTagline && (
              <p className="client-tagline" aria-label={`Client tagline: "${lead.clientTagline}"`}>
                "{lead.clientTagline}"
              </p>
            )}
            <p aria-label={`Lead brief: ${lead.blurb}`}>{lead.blurb}</p>
            <ul className="lead-stats" aria-label="Lead stats">
              <li>{lead.totalStoryPoints} SP total</li>
              <li>
                {effectiveDays} day deadline
                {waitPenalty > 0 && ` (−${waitPenalty}d for waiting)`}
              </li>
              <li>${lead.payment} on completion</li>
              {lead.repRequired > 0 && <li>{lead.repRequired} rep required</li>}
            </ul>
            <div className="action-row">
              <button
                type="button"
                className="btn btn--deploy"
                aria-label={`Accept lead from ${lead.clientName}`}
                onClick={() => acceptLead(lead.id)}
                disabled={!canAccept}
              >
                Accept
              </button>
              <button
                type="button"
                className="btn btn--small"
                aria-label={`Reject lead from ${lead.clientName}`}
                onClick={() => dispatchAt((at) => rejectLeadMsg(at, lead.id))}
              >
                Reject
              </button>
            </div>
          </article>
        )
      })}
    </section>
  )
}
