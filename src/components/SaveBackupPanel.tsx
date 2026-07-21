import { useState } from 'react'
import { hydrateFromSave } from '../game/messages'
import { useGameDispatchAt, useGameState } from '../runtime/GameRuntime'
import { decodeSaveImport, encodeSaveExport } from '../runtime/persist'

export function SaveBackupPanel() {
  const state = useGameState()
  const dispatchAt = useGameDispatchAt()
  const [importCode, setImportCode] = useState('')
  const [exportCode, setExportCode] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleExport() {
    const code = encodeSaveExport(state)
    setExportCode(code)
    setCopied(false)
    setImportError(null)
    void navigator.clipboard?.writeText(code).then(() => setCopied(true))
  }

  function handleImportClick() {
    setImportError(null)
    const imported = decodeSaveImport(importCode)
    if (!imported) {
      setImportError('Invalid save code — check the paste and try again.')
      return
    }
    setConfirming(true)
  }

  function handleImportConfirm() {
    const imported = decodeSaveImport(importCode)
    if (!imported) {
      setImportError('Invalid save code — check the paste and try again.')
      setConfirming(false)
      return
    }
    dispatchAt((at) => hydrateFromSave(imported, at))
    setConfirming(false)
    setImportCode('')
    setExportCode(null)
    setImportError(null)
  }

  return (
    <section className="save-backup" aria-labelledby="save-backup-heading">
      <h3 id="save-backup-heading" className="status-panel__section">
        Save backup
      </h3>
      <p className="hint">
        Export full game state as base64 for debugging. Import replaces your current save.
      </p>

      <div className="save-backup__actions">
        <button
          type="button"
          className="btn"
          data-testid="save-export"
          onClick={handleExport}
        >
          Export save
        </button>
        {copied && (
          <span className="hint save-backup__copied" aria-live="polite">
            Copied to clipboard
          </span>
        )}
      </div>

      {exportCode && (
        <textarea
          className="save-backup__code"
          readOnly
          value={exportCode}
          aria-label="Exported save code"
          rows={4}
          onFocus={(e) => e.target.select()}
        />
      )}

      <label className="save-backup__import-label" htmlFor="save-import-code">
        Import save code
      </label>
      <textarea
        id="save-import-code"
        className="save-backup__code"
        data-testid="save-import"
        value={importCode}
        onChange={(e) => {
          setImportCode(e.target.value)
          setImportError(null)
        }}
        placeholder="Paste o404:v10:… save code here"
        rows={4}
        aria-label="Import save code"
      />
      {importError && (
        <p className="hint text-danger" role="alert">
          {importError}
        </p>
      )}
      <button
        type="button"
        className="btn"
        data-testid="save-import-submit"
        disabled={!importCode.trim()}
        onClick={handleImportClick}
      >
        Import save
      </button>

      {confirming && (
        <div className="game-overlay" role="dialog" aria-label="Confirm save import">
          <div className="game-overlay__card">
            <h2>Import save?</h2>
            <p>
              This replaces your current agency, roster, and projects with the imported save.
              Prestige meta from the import is kept. This cannot be undone.
            </p>
            <div className="game-overlay__actions">
              <button
                type="button"
                className="btn btn--danger"
                data-testid="save-import-confirm"
                onClick={handleImportConfirm}
              >
                Import
              </button>
              <button type="button" className="btn" onClick={() => setConfirming(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
