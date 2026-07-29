export { ApiError, invalidateCache, SESSION_LOCKED_EVENT } from './client'
export * from './ai'
export * from './auth'
export * from './bootstrap'
export * from './categories'
export * from './financial'
export * from './ocr'
export * from './push'
export * from './recurringPayments'
export * from './system'
export * from './transactions'
export * from './wishlist'
export * from './investments'
// './documents' is deliberately NOT re-exported here. This barrel is on the eager
// critical path, and every vault consumer is lazy (the Documents view, the ledger
// attachment field) or defers to a queued sync. Import from './api/documents' directly.
