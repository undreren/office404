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
import { TICK_INTERVAL_MS } from '../game/constants'
import { dispatch } from '../game/engine/dispatch'
import type { GameMessage } from '../game/engine/Message'
import { hydrateFromSave, newGame, resetGameMsg, stateChanged, timeElapsed } from '../game/messages'
import { createRngSeed } from '../game/rng'
import type { GameState } from '../game/types'
import { createInitialState } from '../game/simulation/gameLogic'
import { applyFixtureFromUrl } from './fixture-loader'
import { loadPersistedState, savePersistedState } from './persist'

type GameRuntimeContextValue = {
  state: GameState
  dispatch: (message: GameMessage) => void
  dispatchPurchase: (message: GameMessage) => boolean
  hydrated: boolean
  paused: boolean
  setPaused: (paused: boolean) => void
}

const GameRuntimeContext = createContext<GameRuntimeContextValue | null>(null)

function bootState(at: number): GameState {
  const saved = loadPersistedState()
  if (saved) return dispatch(saved, hydrateFromSave(saved, at))
  return createInitialState(at, createRngSeed())
}

export function GameRuntimeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [paused, setPaused] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const at = Date.now()
      const fixture = await applyFixtureFromUrl()
      if (cancelled) return
      if (fixture) {
        setState(dispatch(fixture, hydrateFromSave(fixture, at)))
      } else {
        setState(bootState(at))
      }
      setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
    if (!hydrated || !state || paused) return
    const interval = setInterval(() => {
      const at = Date.now()
      dispatchMsg(timeElapsed(at, TICK_INTERVAL_MS / 1000))
    }, TICK_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [hydrated, dispatchMsg, state, paused])

  useEffect(() => {
    if (!hydrated || !state) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => savePersistedState(state), 500)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [state, hydrated])

  const value = useMemo((): GameRuntimeContextValue | null => {
    if (!state) return null
    return { state, dispatch: dispatchMsg, dispatchPurchase, hydrated, paused, setPaused }
  }, [state, dispatchMsg, dispatchPurchase, hydrated, paused])

  if (!value) {
    return null
  }

  return <GameRuntimeContext.Provider value={value}>{children}</GameRuntimeContext.Provider>
}

export function useGameRuntime(): GameRuntimeContextValue {
  const ctx = useContext(GameRuntimeContext)
  if (!ctx) throw new Error('useGameRuntime must be used within GameRuntimeProvider')
  return ctx
}

export function useGameState(): GameState {
  return useGameRuntime().state
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
