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
import { MIN_OFFLINE_APPLY_SEC } from '../game/constants'
import { dispatch } from '../game/engine/dispatch'
import type { GameMessage } from '../game/engine/Message'
import {
  hydrateFromSave,
  newGame,
  resetGameMsg,
  returnFromHiddenMsg,
  stateChanged,
  syncOfflineSpecialistMsg,
  catchUpToMsg,
} from '../game/messages'
import { createRngSeed } from '../game/rng'
import type { GameState } from '../game/types'
import { createInitialState, syncOfflineSpecialist } from '../game/simulation/gameLogic'
import { catchUpTo, catchUpOffline } from '../game/time'
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

function needsOfflineCatchUp(saved: GameState, at: number): boolean {
  if (!saved.vibingCourses.includes('offline') || saved.phase !== 'playing') return false
  return at - saved.snapshotAt >= MIN_OFFLINE_APPLY_SEC * 1000
}

function runCatchUp(state: GameState, at: number): GameState {
  if (state.vibingCourses.includes('offline')) {
    return catchUpOffline(state, at)
  }
  return catchUpTo(state, at)
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
    const at = Date.now()
    void applyFixtureFromUrl().then((fixture) => {
      if (cancelled) return
      if (fixture) {
        const next = dispatch(fixture, hydrateFromSave(fixture, at))
        applyHydratedState(next)
        return
      }

      const saved = loadPersistedState()
      if (!saved) {
        setState(createInitialState(at, createRngSeed()))
        setHydrated(true)
        return
      }

      if (needsOfflineCatchUp(saved, at)) {
        setCatchingUp(true)
      }
      const next = dispatch(saved, hydrateFromSave(saved, at))
      if (cancelled) return
      setCatchingUp(false)
      applyHydratedState(next)
    })
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

      hiddenAtRef.current = null
      const elapsedMs = at - (stateRef.current?.snapshotAt ?? at)
      if (elapsedMs < MIN_OFFLINE_APPLY_SEC * 1000) {
        dispatchMsg(returnFromHiddenMsg(at))
        return
      }

      setCatchingUp(true)
      const current = stateRef.current
      if (!current) return
      const next = syncOfflineSpecialist(runCatchUp(current, at), false, at)
      setState(next)
      setCatchingUp(false)
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
      dispatchMsg(catchUpToMsg(at))
    }, 1000 / 30)
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
