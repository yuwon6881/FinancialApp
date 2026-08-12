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
// './loans' is deliberately NOT re-exported: loan cards and their full-history replay are only
// needed by the lazy Recurring Payments section; bootstrap maps the payload at the boundary and
// CRUD/sync callers import this module directly.
// './accounts' is deliberately NOT re-exported: the Settings account-management tab is lazy,
// while the startup list arrives in bootstrap. CRUD and queued sync callers import it directly.
//
// './documents' is deliberately NOT re-exported here. This barrel is on the eager
// critical path, and every vault consumer is lazy (the Documents view, the ledger
// attachment field) or defers to a queued sync. Import from './api/documents' directly.
