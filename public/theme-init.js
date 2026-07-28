(function () {
  try {
    var stored = localStorage.getItem('dark_mode')
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