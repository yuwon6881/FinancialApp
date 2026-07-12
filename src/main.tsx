import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { startTrackingVitals } from './lib/vitals'

startTrackingVitals()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary variant="screen">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
