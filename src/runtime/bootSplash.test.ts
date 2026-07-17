import { describe, expect, it } from 'vitest'
import { ensureBootSplash, updateBootSplash } from './bootSplash'

describe('bootSplash', () => {
  it('creates a splash when the cached shell omitted it', () => {
    document.body.innerHTML = '<div id="root"></div>'

    const splash = ensureBootSplash()

    expect(splash.id).toBe('boot-splash')
    expect(splash.querySelector('.boot-splash__title')?.textContent).toBe('Office 404')
    expect(splash.querySelector('.boot-splash__status')?.textContent).toBe('Loading…')
    expect(document.getElementById('boot-splash-keyframes')).not.toBeNull()
  })

  it('updates splash status and visibility', () => {
    document.body.innerHTML = `
      <div id="boot-splash" style="display:flex" aria-busy="true">
        <p class="boot-splash__status">Loading…</p>
      </div>
    `

    updateBootSplash({ visible: true, status: 'Catching up while you were away…' })
    const splash = document.getElementById('boot-splash')!
    expect(splash.style.display).toBe('flex')
    expect(splash.querySelector('.boot-splash__status')?.textContent).toBe(
      'Catching up while you were away…',
    )
    expect(splash.getAttribute('aria-busy')).toBe('true')

    updateBootSplash({ visible: false })
    expect(splash.style.display).toBe('none')
    expect(splash.getAttribute('aria-busy')).toBe('false')
  })
})
