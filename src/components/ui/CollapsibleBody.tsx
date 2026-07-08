import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Pure height/opacity animation for a collapsible section's body -- callers own their own
// header/toggle button and just gate rendering on `open`. Kept deliberately dumb (no header,
// no state) so it can slot into headers of very different shapes (plain, or ones with their
// own nested interactive controls) without fighting a more opinionated wrapper.
export const CollapsibleBody: React.FC<{ open: boolean; children: React.ReactNode }> = ({ open, children }) => (
  <AnimatePresence initial={false}>
    {open && (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden"
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
)
