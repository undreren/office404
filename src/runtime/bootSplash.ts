const STATUS_SELECTOR = '.boot-splash__status'

export function updateBootSplash(options: { visible: boolean; status?: string }): void {
  const splash = document.getElementById('boot-splash')
  if (!splash) return

  if (options.status) {
    const status = splash.querySelector(STATUS_SELECTOR)
    if (status) status.textContent = options.status
  }

  splash.style.display = options.visible ? 'flex' : 'none'
  splash.setAttribute('aria-busy', options.visible ? 'true' : 'false')
}
