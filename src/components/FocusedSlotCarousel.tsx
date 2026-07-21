import type { ReactNode } from 'react'
import { useSwipeCarousel } from '../hooks/useSwipeCarousel'

export type SlotNavItem = {
  title: string
}

type FocusedSlotCarouselProps = {
  index: number
  count: number
  onIndexChange: (index: number) => void
  listAriaLabel: string
  navItems: SlotNavItem[]
  children: ReactNode
}

export function FocusedSlotCarousel({
  index,
  count,
  onIndexChange,
  listAriaLabel,
  navItems,
  children,
}: FocusedSlotCarouselProps) {
  const enabled = count > 1
  const { onTouchStart, onTouchEnd } = useSwipeCarousel({
    index,
    count,
    onIndexChange,
    enabled,
  })

  return (
    <>
      <div
        className={`project-columns project-columns--focused-slot ${enabled ? 'project-columns--swipeable' : ''}`}
        role="list"
        aria-label={listAriaLabel}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
      {enabled && (
        <div className="swipe-carousel__footer">
          <div className="swipe-carousel__dots" role="tablist" aria-label={`${listAriaLabel} navigation`}>
            {navItems.map((item, i) => (
              <button
                key={item.title}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={item.title}
                className={`swipe-carousel__dot ${i === index ? 'swipe-carousel__dot--active' : ''}`}
                onClick={() => onIndexChange(i)}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
