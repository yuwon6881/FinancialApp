import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'

// Web-vitals console logging is a dev-only aid; keep it out of the production
// bundle entirely via a dynamic dev-gated import.
if (import.meta.env.DEV) {
  import('./lib/vitals').then(({ startTrackingVitals }) => startTrackingVitals())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary variant="screen">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
