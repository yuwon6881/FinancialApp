export interface VaultDocument {
  id: number
  originalFileName: string
  contentType: string
  sizeBytes: number
  taxYear: number
  reliefCategory?: string | null
  amount?: number | null
  amountCurrency: 'MYR' | 'OTHER'
  amountStatus: 'Pending' | 'NeedsReview' | 'Confirmed' | 'NotFound' | 'Failed' | 'Unavailable'
  amountConfidence?: number | null
  amountExtractionMessage?: string | null
  transactionId?: string | null
  uploadedAt: string
  retentionUntil: string
  isPendingSync?: boolean
  isPendingDelete?: boolean
}

export interface DocumentVaultUsage {
  totalBytes: number
  documentCount: number
  // Echoed from the server's DocumentVault:MaxTotalBytesPerUser so the usage meter
  // reports the real quota instead of assuming one.
  quotaBytes: number
}

export interface DocumentVaultConstraints {
  maxDocumentBytes: number
  maxBulkDocuments: number
  maxTotalBytesPerUser: number
}

export interface TaxReliefCategoryDefinition {
  id: string
  name: string
  limit: number
  isInherited?: boolean
  isPendingSync?: boolean
  isPendingDelete?: boolean
  pendingSyncOperationId?: string
}

export interface TaxReliefCategorySummary extends TaxReliefCategoryDefinition {
  confirmedAmount: number
  pendingReviewAmount: number
  documentCount: number
  pendingReviewCount: number
}

export interface TaxYearReliefSummary {
  taxYear: number
  confirmedAmount: number
  pendingReviewAmount: number
  documentCount: number
  categories: TaxReliefCategorySummary[]
}

/**
 * One tax year's stored records measured against the date they stop being worth keeping.
 * `daysUntilKeepUntil` is negative once that date has passed, and is the only thing separating
 * records that can be cleared out now from ones still worth holding.
 */
export interface RetentionTaxYearSummary {
  taxYear: number
  documentCount: number
  totalBytes: number
  keepUntil: string
  daysUntilKeepUntil: number
}

/**
 * `noticeWindowDays` and `keepYears` are echoed by the server so no screen states the keep period
 * from its own copy of the number.
 */
export interface DocumentRetentionReview {
  taxYears: RetentionTaxYearSummary[]
  noticeWindowDays: number
  keepYears: number
}

export interface PendingVaultDocument {
  file: File
  taxYear: number
  reliefCategory: string
  amount?: number
  amountCurrency?: 'MYR' | 'OTHER'
}

export interface TransactionDocumentChanges {
  pending: PendingVaultDocument[]
  unlinkIds: number[]
}
