// Framer Motion's full feature bundle (drag + layout + animation), isolated so it can be
// code-split away from the app shell.
//
// This deliberately imports the internal feature module rather than `domMax` from the
// package root. The root is a barrel that the app already imports statically for `m`,
// `LazyMotion` and `AnimatePresence`, so `import('framer-motion')` resolves to a module
// that is *already* in the static graph — the bundler then has nothing to defer and emits
// one eager chunk containing every feature. Verified: routed through the root, the drag
// implementation shipped in the same statically-imported chunk as the app shell.
//
// The trade-off is a dependency on a path inside framer-motion's dist, which is not part
// of its public API and can move between versions. `framer-motion-features` is a Vite
// alias pointing at that file (the package's exports map does not publish it, so a bare
// deep import will not resolve). motionFeatures.test.ts asserts the alias still resolves
// to something shaped like a feature bundle, so a framer-motion upgrade that moves the
// file fails a test rather than silently regressing to an eager bundle.
import type { FeatureBundle } from 'framer-motion'
// @ts-expect-error -- aliased in vite.config.ts; no published type declarations.
import { domMax } from 'framer-motion-features'

export default domMax as FeatureBundle
