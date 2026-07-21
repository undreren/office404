import { describe, expect, it } from 'vitest'
import { createPwaManifest, pwaIconPath } from './pwaManifest'

describe('pwa manifest icons', () => {
  it('uses root-absolute icon paths for local dev', () => {
    expect(pwaIconPath('/', 'pwa-192.png')).toBe('/pwa-192.png')
    expect(createPwaManifest('/').icons[0]?.src).toBe('/pwa-192.png')
  })

  it('uses base-prefixed absolute icon paths for GitHub Pages', () => {
    const manifest = createPwaManifest('/office404/')

    expect(manifest.icons[0]?.src).toBe('/office404/pwa-192.png')
    expect(manifest.icons[1]?.src).toBe('/office404/pwa-512.png')
    expect(manifest.icons[2]?.src).toBe('/office404/pwa-512.png')
  })

  it('marks the default icons as any-purpose for Firefox install', () => {
    const manifest = createPwaManifest('/office404/')

    expect(manifest.icons[0]?.purpose).toBe('any')
    expect(manifest.icons[1]?.purpose).toBe('any')
    expect(manifest.icons[2]?.purpose).toBe('maskable')
  })
})
