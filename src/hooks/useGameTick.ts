import { useEffect } from 'react'
import { TICK_INTERVAL_MS } from '../game/constants'
import { useGameStore } from '../game/store'

export function useGameTick() {
  const tick = useGameStore((s) => s.tick)

  useEffect(() => {
    const interval = setInterval(() => {
      tick(TICK_INTERVAL_MS / 1000)
    }, TICK_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [tick])
}

export function useOfflineProgress() {
  const applyOfflineProgress = useGameStore((s) => s.applyOfflineProgress)
  const lastTickAt = useGameStore((s) => s.lastTickAt)

  useEffect(() => {
    const elapsed = (Date.now() - lastTickAt) / 1000
    if (elapsed > 5) {
      applyOfflineProgress(elapsed)
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
