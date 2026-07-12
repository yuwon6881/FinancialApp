import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals'

export function startTrackingVitals() {
  const logVital = (metric: Metric) => {
    console.log(`[Web Vitals] ${metric.name}:`, metric.value, metric.entries)
  }

  try {
    onCLS(logVital)
    onINP(logVital)
    onLCP(logVital)
    onFCP(logVital)
    onTTFB(logVital)
  } catch (err) {
    console.error('Failed to initialize web-vitals tracking', err)
  }
}
