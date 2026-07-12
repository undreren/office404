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
  slides: ReactNode[]
  panelClassName?: string
}

export function SwipeCarousel({
  index,
  onIndexChange,
  headers,
  slides,
  panelClassName = '',
}: SwipeCarouselProps) {
  const count = headers.length
  const enabled = count > 1
  const { onTouchStart, onTouchEnd } = useSwipeCarousel({
    index,
    count,
    onIndexChange,
    enabled,
  })

  return (
    <section className={`panel swipe-carousel ${panelClassName}`.trim()}>
      <div
        className={`swipe-carousel__swipeable ${enabled ? 'swipe-carousel__swipeable--enabled' : ''}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="swipe-carousel__viewport">
          <div
            className="swipe-carousel__track"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {headers.map((header, i) => (
              <div key={header.title} className="swipe-carousel__slide" aria-hidden={i !== index}>
                <div className="swipe-carousel__header">
                  <div className="swipe-carousel__titles">
                    <h2>{header.title}</h2>
                    {header.subtitle && (
                      <p className="swipe-carousel__subtitle">{header.subtitle}</p>
                    )}
                  </div>
                </div>
                <div className="swipe-carousel__body">{slides[i]}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {enabled && (
        <div className="swipe-carousel__footer">
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
        </div>
      )}
    </section>
  )
}
