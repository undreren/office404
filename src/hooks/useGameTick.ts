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
