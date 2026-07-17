const STATUS_SELECTOR = '.boot-splash__status'
const SPINNER_STYLE_ID = 'boot-splash-keyframes'

const SPLASH_HTML = `
  <p class="boot-splash__title">Office 404</p>
  <div class="boot-splash__spinner" aria-hidden="true"></div>
  <p class="boot-splash__status">Loading…</p>
  <p class="boot-splash__recover"><a href="recover.html">Blank screen? Recover your save</a></p>
`

/** Inline styles so the splash paints even when cached HTML/CSS is stale. */
const SPLASH_CSS_TEXT = `
  @keyframes boot-spin { to { transform: rotate(360deg); } }
  #boot-splash {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    background: #0a0e14;
    color: #6b7d99;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    text-align: center;
    padding: 1.5rem;
  }
  #boot-splash .boot-splash__title {
    margin: 0;
    color: #c8d4e8;
    font-size: 1.15rem;
    letter-spacing: 0.04em;
  }
  #boot-splash .boot-splash__status {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.4;
    max-width: 18rem;
  }
  #boot-splash .boot-splash__spinner {
    width: 2rem;
    height: 2rem;
    border: 2px solid #243044;
    border-top-color: #39d98a;
    border-radius: 50%;
    animation: boot-spin 0.9s linear infinite;
  }
  #boot-splash .boot-splash__recover {
    margin: 0.5rem 0 0;
    font-size: 0.8rem;
  }
  #boot-splash .boot-splash__recover a {
    color: #39d98a;
    text-decoration: underline;
    text-underline-offset: 0.15em;
  }
`

function ensureSpinnerKeyframes(): void {
  if (document.getElementById(SPINNER_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = SPINNER_STYLE_ID
  style.textContent = SPLASH_CSS_TEXT
  document.head.appendChild(style)
}

/** Create the boot splash if missing (e.g. stale iOS PWA shell cached without it). */
export function ensureBootSplash(): HTMLElement {
  ensureSpinnerKeyframes()

  const existing = document.getElementById('boot-splash')
  if (existing) return existing

  const splash = document.createElement('div')
  splash.id = 'boot-splash'
  splash.setAttribute('aria-live', 'polite')
  splash.setAttribute('aria-busy', 'true')
  splash.innerHTML = SPLASH_HTML
  document.body.prepend(splash)
  return splash
}

export function updateBootSplash(options: { visible: boolean; status?: string }): void {
  const splash = ensureBootSplash()

  if (options.status) {
    const status = splash.querySelector(STATUS_SELECTOR)
    if (status) status.textContent = options.status
  }

  splash.style.display = options.visible ? 'flex' : 'none'
  splash.setAttribute('aria-busy', options.visible ? 'true' : 'false')
}
