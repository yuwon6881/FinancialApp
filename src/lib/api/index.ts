export { ApiError, invalidateCache, SESSION_LOCKED_EVENT } from './client'
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
// './savingsGoals' is deliberately NOT re-exported here either, for the same reason: goals arrive
// with the boot payload, and every other goal call is user-initiated (from the lazy Rewards view or
// a queued sync), so keeping it out of this barrel keeps it off the eager critical path.
//
// './documents' is deliberately NOT re-exported here. This barrel is on the eager
// critical path, and every vault consumer is lazy (the Documents view, the ledger
// attachment field) or defers to a queued sync. Import from './api/documents' directly.
