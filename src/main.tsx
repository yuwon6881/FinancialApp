import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LazyMotion, MotionConfig } from 'framer-motion'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'

// Framer Motion's feature bundle, loaded off the critical path.
//
// Components import the lightweight `m` component instead of `motion`, which carries no
// features of its own; LazyMotion supplies them. `motion` pulls the entire feature set
// into the initial chunk even on a screen that animates nothing, which on a cold mobile
// launch is parse work competing with first paint.
//
// `domMax` (not `domAnimation`) is deliberate: it is the set that includes drag and
// layout, which SwipeableRow, BottomSheet, ToastViewport and the investment-plan Reorder
// list all need. Splitting per-subtree would ship less, but a drag component rendered
// under a features bundle lacking drag loses its gestures *silently* — and on this app
// that would mean swipe-to-edit/delete quietly dying on the ledger. One superset for the
// whole tree keeps the win (nothing blocks first paint) without that failure mode.
//
// LazyMotion starts the import when it mounts, so the features are typically in place
// before anything animates; until then `m` components render at their initial state.
// See lib/motionFeatures for why the bundle is not imported from the package root.
const loadMotionFeatures = () => import('./lib/motionFeatures').then(mod => mod.default)

// Web-vitals console logging is a dev-only aid; keep it out of the production
// bundle entirely via a dynamic dev-gated import.
if (import.meta.env.DEV) {
  import('./lib/vitals').then(({ startTrackingVitals }) => startTrackingVitals())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary variant="screen">
      {/* reducedMotion="user" makes every m/motion component in the tree honour the OS
          setting without per-component useReducedMotion calls (it was only wired up in 5
          files). The CSS entrances have their own prefers-reduced-motion block. */}
      <MotionConfig reducedMotion="user">
        {/* `strict` in dev only: it throws if a full `motion` component is rendered in
            this tree, which would pull the feature bundle back into the initial chunk and
            silently undo the split. It is a dev guard, not a production failure mode. */}
        <LazyMotion features={loadMotionFeatures} strict={import.meta.env.DEV}>
          <App />
        </LazyMotion>
      </MotionConfig>
    </ErrorBoundary>
  </StrictMode>,
)
