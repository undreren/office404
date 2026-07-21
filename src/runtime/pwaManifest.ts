export function pwaIconPath(base: string, filename: string): string {
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base
  if (!normalizedBase || normalizedBase === '/') {
    return `/${filename}`
  }
  return `${normalizedBase}/${filename}`
}

export function createPwaManifest(base: string) {
  return {
    name: 'Office 404: Intelligence Not Found',
    short_name: 'Office 404',
    description:
      'A darkly comedic idle game about running a one-man AI agency in a glitching corporate hellscape.',
    theme_color: '#0a0e14',
    background_color: '#0a0e14',
    display: 'standalone' as const,
    orientation: 'portrait' as const,
    start_url: base,
    scope: base,
    icons: [
      {
        src: pwaIconPath(base, 'pwa-192.png'),
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: pwaIconPath(base, 'pwa-512.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: pwaIconPath(base, 'pwa-512.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
