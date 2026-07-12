import { useCallback, useRef } from 'react'

const SWIPE_THRESHOLD_PX = 50

export function useSwipeCarousel({
  index,
  count,
  onIndexChange,
  enabled = true,
}: {
  index: number
  count: number
  onIndexChange: (index: number) => void
  enabled?: boolean
}) {
  const touchStartX = useRef<number | null>(null)

  const goNext = useCallback(() => {
    if (!enabled || count <= 1) return
    onIndexChange((index + 1) % count)
  }, [count, enabled, index, onIndexChange])

  const goPrev = useCallback(() => {
    if (!enabled || count <= 1) return
    onIndexChange((index - 1 + count) % count)
  }, [count, enabled, index, onIndexChange])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }, [])

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || count <= 1 || touchStartX.current === null) return
      const endX = e.changedTouches[0]?.clientX
      if (endX === undefined) return
      const deltaX = endX - touchStartX.current
      if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return
      if (deltaX < 0) goNext()
      else goPrev()
      touchStartX.current = null
    },
    [count, enabled, goNext, goPrev],
  )

  return { onTouchStart, onTouchEnd, goNext, goPrev }
}
