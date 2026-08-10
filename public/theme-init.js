(function () {
  try {
    // Theme preferences are account-scoped. The last signed-in username is
    // available before React starts, so use the same key the app will resolve
    // after session bootstrap and avoid a light/dark flash in an installed PWA.
    // The unscoped key is retained only as a migration fallback for older builds.
    var owner = localStorage.getItem('auth_username')
    var scoped = owner ? localStorage.getItem('dark_mode:' + owner) : null
    var stored = scoped === null ? localStorage.getItem('dark_mode') : scoped
    var isDark = stored === 'true'
      ? true
      : stored === 'false'
        ? false
        : !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
    var surface = isDark ? '#0b0e14' : '#fcfcfc'
    var root = document.documentElement
    if (isDark) root.classList.add('dark')
    root.style.setProperty('--launch-surface', surface)
    root.style.backgroundColor = surface
    root.style.colorScheme = isDark ? 'dark' : 'light'
    var meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', surface)
  } catch {
    // Storage can be unavailable; the inline CSS retains an OS-aware fallback.
  }
})()
