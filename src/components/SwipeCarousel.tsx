import type { ReactNode } from 'react'
import { useSwipeCarousel } from '../hooks/useSwipeCarousel'

export type CarouselSlideHeader = {
  title: string
  subtitle?: string
}

type SwipeCarouselProps = {
  index: number
  onIndexChange: (index: number) => void
  headers: CarouselSlideHeader[]
  children: ReactNode
  panelClassName?: string
}

export function SwipeCarousel({
  index,
  onIndexChange,
  headers,
  children,
  panelClassName = '',
}: SwipeCarouselProps) {
  const count = headers.length
  const enabled = count > 1
  const header = headers[index] ?? headers[0]
  const { onTouchStart, onTouchEnd } = useSwipeCarousel({
    index,
    count,
    onIndexChange,
    enabled,
  })

  return (
    <section className={`panel swipe-carousel ${panelClassName}`.trim()}>
      <div
        className={`swipe-carousel__header ${enabled ? 'swipe-carousel__header--swipeable' : ''}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="swipe-carousel__titles">
          <h2>{header?.title}</h2>
          {header?.subtitle && <p className="swipe-carousel__subtitle">{header.subtitle}</p>}
        </div>
        {enabled && (
          <div className="swipe-carousel__dots" role="tablist" aria-label="Slide navigation">
            {headers.map((slide, i) => (
              <button
                key={slide.title}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={slide.title}
                className={`swipe-carousel__dot ${i === index ? 'swipe-carousel__dot--active' : ''}`}
                onClick={() => onIndexChange(i)}
              />
            ))}
          </div>
        )}
      </div>
      <div className="swipe-carousel__body">{children}</div>
    </section>
  )
}
