/** Reduced user agents still identify the browser and OS without revealing a device model. */
export function getFriendlyDeviceLabel(ua = globalThis.navigator?.userAgent ?? ''): string {
  const os = /Android/i.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/i.test(ua) ? 'iOS'
      : /Windows/i.test(ua) ? 'Windows'
        : /CrOS/i.test(ua) ? 'ChromeOS'
          : /Macintosh|Mac OS X/i.test(ua) ? 'macOS'
            : /Linux/i.test(ua) ? 'Linux' : null
  const browser = /Edg(?:A|iOS)?\//i.test(ua) ? 'Edge'
    : /OPR\/|Opera/i.test(ua) ? 'Opera'
      : /SamsungBrowser\//i.test(ua) ? 'Samsung Internet'
        : /(?:Chrome|CriOS)\//i.test(ua) ? 'Chrome'
          : /(?:Firefox|FxiOS)\//i.test(ua) ? 'Firefox'
            : /Safari\//i.test(ua) ? 'Safari' : 'Web browser'
  return os ? `${browser} on ${os}` : browser
}
