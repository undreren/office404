import { CODE_SHIP_THRESHOLD } from '../game/constants'
import { useGameStore } from '../game/store'

export function SprintPanel() {
  const codeProgress = useGameStore((s) => s.codeProgress)
  const deadlinePressure = useGameStore((s) => s.deadlinePressure)
  const mode = useGameStore((s) => s.mode)
  const modeTimer = useGameStore((s) => s.modeTimer)
  const sanity = useGameStore((s) => s.sanity)
  const startSprint = useGameStore((s) => s.startSprint)
  const startZoning = useGameStore((s) => s.startZoning)

  const progressPct = (codeProgress / CODE_SHIP_THRESHOLD) * 100

  return (
    <section className="panel sprint-panel">
      <h2>Current Sprint</h2>

      <div className="sprint-progress">
        <div className="meter meter--lg">
          <div className="meter__fill meter__fill--code" style={{ width: `${progressPct}%` }} />
        </div>
        <span>
          {Math.floor(codeProgress)} / {CODE_SHIP_THRESHOLD} story points
        </span>
      </div>

      <div className="deadline">
        <label>Client Deadline Pressure</label>
        <div className="meter">
          <div
            className={`meter__fill meter__fill--deadline ${deadlinePressure > 70 ? 'meter__fill--critical' : ''}`}
            style={{ width: `${deadlinePressure}%` }}
          />
        </div>
      </div>

      <div className="action-row">
        <button
          type="button"
          className={`btn btn--sprint ${mode === 'sprinting' ? 'btn--active' : ''}`}
          onClick={startSprint}
          disabled={sanity < 8 || mode === 'sprinting'}
        >
          {mode === 'sprinting' ? `Sprinting (${Math.ceil(modeTimer)}s)` : 'Code Sprint'}
        </button>
        <button
          type="button"
          className={`btn btn--zone ${mode === 'zoning' ? 'btn--active' : ''}`}
          onClick={startZoning}
          disabled={mode === 'zoning'}
        >
          {mode === 'zoning' ? `Zoning (${Math.ceil(modeTimer)}s)` : 'Zone Out'}
        </button>
      </div>

      <p className="hint">
        Sprint for output, zone out for sanity. Both are valid coping mechanisms.
      </p>
    </section>
  )
}
