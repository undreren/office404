import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { MIN_OFFLINE_APPLY_SEC, TICK_INTERVAL_MS } from '../game/constants'
import { dispatch } from '../game/engine/dispatch'
import type { GameMessage } from '../game/engine/Message'
import {
  hydrateFromSave,
  hydrateFromSaveAsync,
  newGame,
  resetGameMsg,
  returnFromHiddenMsg,
  stateChanged,
  syncOfflineSpecialistMsg,
  timeElapsed,
} from '../game/messages'
import { createRngSeed } from '../game/rng'
import type { GameState } from '../game/types'
import { createInitialState, returnFromHiddenAsync } from '../game/simulation/gameLogic'
import { applyFixtureFromUrl } from './fixture-loader'
import { updateBootSplash } from './bootSplash'
import { loadPersistedState } from './persist'
import { flushPersistSave, trackPersistSave } from './saveScheduler'

type GameRuntimeContextValue = {
  state: GameState | null
  dispatch: (message: GameMessage) => void
  dispatchPurchase: (message: GameMessage) => boolean
  hydrated: boolean
  catchingUp: boolean
  paused: boolean
  setPaused: (paused: boolean) => void
}

const GameRuntimeContext = createContext<GameRuntimeContextValue | null>(null)

function offlineCatchUpSec(saved: GameState, at: number): number {
  if (!saved.vibingCourses.includes('offline') || saved.phase !== 'playing') return 0
  return Math.max(0, (at - saved.snapshotAt) / 1000)
}

/** Elapsed away seconds when the tab returns — uses hide timestamp or save snapshot as fallback. */
function awayElapsedSec(hiddenAtMs: number | null, snapshotAtMs: number, nowMs: number): number {
  if (hiddenAtMs != null) {
    return Math.max(0, (nowMs - hiddenAtMs) / 1000)
  }
  return Math.max(0, (nowMs - snapshotAtMs) / 1000)
}

function needsAsyncOfflineCatchUp(saved: GameState, at: number): boolean {
  return offlineCatchUpSec(saved, at) >= MIN_OFFLINE_APPLY_SEC
}

export function GameRuntimeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [catchingUp, setCatchingUp] = useState(false)
  const [paused, setPaused] = useState(false)
  const [tabHidden, setTabHidden] = useState(() =>
    typeof document !== 'undefined' ? document.hidden : false,
  )
  const hiddenAtRef = useRef<number | null>(null)
  const stateRef = useRef<GameState | null>(null)
  const catchUpRunRef = useRef(0)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const applyHydratedState = useCallback((next: GameState) => {
    const at = Date.now()
    const hidden = typeof document !== 'undefined' && document.hidden
    const hydratedState =
      hidden && next.vibingCourses.includes('offline')
        ? dispatch(next, syncOfflineSpecialistMsg(at, true))
        : next
    if (hidden) hiddenAtRef.current = at
    setState(hydratedState)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) {
      updateBootSplash({
        visible: true,
        status: catchingUp ? 'Catching up while you were away…' : 'Loading save…',
      })
      return
    }
    if (catchingUp) {
      updateBootSplash({ visible: true, status: 'Catching up while you were away…' })
      return
    }
    updateBootSplash({ visible: false })
  }, [hydrated, catchingUp])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const at = Date.now()
      const fixture = await applyFixtureFromUrl()
      if (cancelled) return
      if (fixture) {
        applyHydratedState(dispatch(fixture, hydrateFromSave(fixture, at)))
        return
      }

      const saved = loadPersistedState()
      if (!saved) {
        setState(createInitialState(at, createRngSeed()))
        setHydrated(true)
        return
      }

      if (!needsAsyncOfflineCatchUp(saved, at)) {
        const next = dispatch(saved, hydrateFromSave(saved, at))
        if (cancelled) return
        applyHydratedState(next)
        return
      }

      setCatchingUp(true)
      const next = await hydrateFromSaveAsync(saved, at)
      if (cancelled) return
      setCatchingUp(false)
      applyHydratedState(next)
    })()
    return () => {
      cancelled = true
    }
  }, [applyHydratedState])

  const dispatchMsg = useCallback((message: GameMessage) => {
    setState((prev) => (prev ? dispatch(prev, message) : prev))
  }, [])

  const dispatchPurchase = useCallback(
    (message: GameMessage): boolean => {
      let changed = false
      setState((prev) => {
        if (!prev) return prev
        const next = dispatch(prev, message)
        changed = stateChanged(prev, next)
        return next
      })
      return changed
    },
    [],
  )

  useEffect(() => {
    if (!hydrated || !state) return

    const flushOnExit = () => {
      const current = stateRef.current
      if (!current) return
      flushPersistSave(current, Date.now())
    }

    const onVisibility = () => {
      const at = Date.now()
      const hidden = document.hidden
      setTabHidden(hidden)

      if (!stateRef.current?.vibingCourses.includes('offline')) {
        if (hidden) flushOnExit()
        return
      }

      if (hidden) {
        hiddenAtRef.current = at
        dispatchMsg(syncOfflineSpecialistMsg(at, true))
        flushOnExit()
        return
      }

      const since = hiddenAtRef.current
      hiddenAtRef.current = null
      const elapsedSec = awayElapsedSec(since, stateRef.current.snapshotAt, at)
      if (elapsedSec < MIN_OFFLINE_APPLY_SEC) {
        dispatchMsg(returnFromHiddenMsg(at, elapsedSec))
        return
      }

      const runId = catchUpRunRef.current + 1
      catchUpRunRef.current = runId
      setCatchingUp(true)
      void (async () => {
        const current = stateRef.current
        if (!current) return
        const next = await returnFromHiddenAsync(current, elapsedSec, at)
        if (catchUpRunRef.current !== runId) return
        setState(next)
        setCatchingUp(false)
      })()
    }

    const onPageHide = () => flushOnExit()

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [hydrated, dispatchMsg])

  useEffect(() => {
    if (!hydrated || !state || paused || catchingUp) return
    if (state.vibingCourses.includes('offline') && tabHidden) return

    const interval = setInterval(() => {
      const at = Date.now()
      dispatchMsg(timeElapsed(at, TICK_INTERVAL_MS / 1000))
    }, TICK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [hydrated, dispatchMsg, state, paused, tabHidden, catchingUp])

  useEffect(() => {
    if (!hydrated || !state) return
    trackPersistSave(state)
  }, [state, hydrated])

  const value = useMemo(
    (): GameRuntimeContextValue => ({
      state,
      dispatch: dispatchMsg,
      dispatchPurchase,
      hydrated,
      catchingUp,
      paused,
      setPaused,
    }),
    [state, dispatchMsg, dispatchPurchase, hydrated, catchingUp, paused],
  )

  return <GameRuntimeContext.Provider value={value}>{children}</GameRuntimeContext.Provider>
}

export function useGameRuntime(): GameRuntimeContextValue {
  const ctx = useContext(GameRuntimeContext)
  if (!ctx) throw new Error('useGameRuntime must be used within GameRuntimeProvider')
  return ctx
}

export function useGameState(): GameState {
  const state = useGameRuntime().state
  if (!state) throw new Error('useGameState requires hydrated game state')
  return state
}

export function useGameDispatch() {
  return useGameRuntime().dispatch
}

export function useGameDispatchAt() {
  const dispatchMsg = useGameDispatch()
  return useCallback(
    (factory: (at: number) => GameMessage) => dispatchMsg(factory(Date.now())),
    [dispatchMsg],
  )
}

export function useGameDispatchPurchase() {
  return useGameRuntime().dispatchPurchase
}

export function useGamePaused() {
  const { paused, setPaused } = useGameRuntime()
  return { paused, setPaused }
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export { newGame, resetGameMsg, createInitialState, createRngSeed }
