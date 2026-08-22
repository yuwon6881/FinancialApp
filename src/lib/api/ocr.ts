import { deobfuscateAmount } from './amounts'
import { apiFetch, request, requestVoid, throwApiError } from './client'

export interface ReceiptScanResult {
  description: string
  amount: number | null
  date: string | null
  category: string
  ledgerCategory: string
  txType: 'inflow' | 'outflow'
  confidence: number
}

export interface ReceiptScanJob {
  scanId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  result: ReceiptScanResult | null
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
  completedAt?: string | null
}

export type ReceiptSplitChargeKind = 'tax' | 'service' | 'tip' | 'discount' | 'rounding' | 'other'
export type ReceiptSplitChargeOperation = 'add' | 'subtract' | 'included'
export type ReceiptSplitChargeBasis = 'subtotal' | 'runningTotal'

export interface ReceiptSplitItem {
  name: string
  quantity: number
  unitPrice: number | null
  lineTotal: number | null
  confidence: number
}

export interface ReceiptSplitCharge {
  label: string
  kind: ReceiptSplitChargeKind
  operation: ReceiptSplitChargeOperation
  basis: ReceiptSplitChargeBasis
  amount: number | null
  ratePercent: number | null
  sequence: number
  eligibleItemIndexes: number[]
  confidence: number
}

export interface ReceiptSplitFieldConfidence {
  description: number
  date: number
  currency: number
  subtotal: number
  total: number
}

export interface ReceiptSplitScanResult {
  description: string
  date: string | null
  currency: string | null
  subtotal: number | null
  total: number | null
  category: string
  ledgerCategory: string
  items: ReceiptSplitItem[]
  charges: ReceiptSplitCharge[]
  fieldConfidence: ReceiptSplitFieldConfidence
  truncated: boolean
  warnings: string[]
  confidence: number
}

export interface ReceiptSplitScanJob {
  scanId: string
  status: ReceiptScanJob['status']
  result: ReceiptSplitScanResult | null
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
  completedAt?: string | null
}

export interface InvestmentActivityScanResult {
  type: 'Buy' | 'Sell' | 'Dividend' | 'FeeTax' | 'Deposit' | 'Withdrawal' | 'Conversion' | null
  accountId: string | null
  instrumentId: string | null
  tradeDate: string | null
  units: number | null
  unitPrice: number | null
  cashAmount: number | null
  fees: number | null
  taxes: number | null
  currency?: string | null
  toCurrency?: string | null
  toAmount?: number | null
  confidence: number
}

export interface InvestmentScanJob {
  scanId: string
  status: ReceiptScanJob['status']
  result: InvestmentActivityScanResult | null
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
  completedAt?: string | null
}

type WireReceiptScanJob = Omit<ReceiptScanJob, 'result'> & {
  result: (Omit<ReceiptScanResult, 'amount'> & { amount: string | number | null }) | null
}

/**
 * A camera photo routinely lands well past the 10 MB the scan endpoints accept, and the whole
 * file has to cross a phone connection before the job can even start. Downscale it the way the
 * document vault does, but with a longer edge and less loss, because small print on a receipt is
 * the thing being read. Non-images, HEIC, already-small files and any decode failure come back
 * untouched, so this can only ever shrink a real photo.
 */
async function scanFormData(imageFile: File): Promise<FormData> {
  const { compressImageFile } = await import('../imageCompression')
  const formData = new FormData()
  formData.append('image', await compressImageFile(imageFile, { maxEdge: 2400, quality: 0.85 }))
  return formData
}

export async function startReceiptScan(imageFile: File): Promise<{ scanId: string; status: string }> {
  const formData = await scanFormData(imageFile)
  const response = await apiFetch('/ocr/scan-receipt/jobs', { method: 'POST', body: formData })
  if (!response.ok) await throwApiError(response, 'Could not start receipt scan. Please try again.')
  return response.json()
}

export async function fetchReceiptScanJob(scanId: string): Promise<ReceiptScanJob> {
  const job = await request<WireReceiptScanJob>(`/ocr/scan-receipt/jobs/${scanId}`, {
    errorMessage: 'Could not fetch receipt scan status.',
  })
  return {
    ...job,
    result: job.result
      ? { ...job.result, amount: job.result.amount == null ? null : deobfuscateAmount(job.result.amount) }
      : null,
  }
}

export async function deleteReceiptScanJob(scanId: string): Promise<void> {
  await requestVoid(`/ocr/scan-receipt/jobs/${scanId}`, {
    method: 'DELETE',
    errorMessage: 'Could not clear receipt scan job.',
  })
}

export async function startReceiptSplitScan(imageFile: File): Promise<{ scanId: string; status: string }> {
  const formData = await scanFormData(imageFile)
  const response = await apiFetch('/ocr/scan-receipt-split/jobs', { method: 'POST', body: formData })
  if (!response.ok) await throwApiError(response, 'Could not start receipt split scan. Please try again.')
  return response.json()
}

type ObfuscatedAmount = string | number | null
type WireReceiptSplitScanJob = Omit<ReceiptSplitScanJob, 'result'> & {
  result: (Omit<ReceiptSplitScanResult, 'subtotal' | 'total' | 'items' | 'charges'> & {
    subtotal: ObfuscatedAmount
    total: ObfuscatedAmount
    items: Array<Omit<ReceiptSplitItem, 'unitPrice' | 'lineTotal'> & {
      unitPrice: ObfuscatedAmount
      lineTotal: ObfuscatedAmount
    }>
    charges: Array<Omit<ReceiptSplitCharge, 'amount'> & { amount: ObfuscatedAmount }>
  }) | null
}

export async function fetchReceiptSplitScanJob(scanId: string): Promise<ReceiptSplitScanJob> {
  const job = await request<WireReceiptSplitScanJob>(`/ocr/scan-receipt/jobs/${scanId}`, {
    errorMessage: 'Could not fetch receipt split scan status.',
  })
  const decode = (value: ObfuscatedAmount) => value == null ? null : deobfuscateAmount(value)
  return {
    ...job,
    result: job.result ? {
      ...job.result,
      subtotal: decode(job.result.subtotal),
      total: decode(job.result.total),
      items: job.result.items.map(item => ({
        ...item,
        unitPrice: decode(item.unitPrice),
        lineTotal: decode(item.lineTotal),
      })),
      charges: job.result.charges.map(charge => ({
        ...charge,
        amount: decode(charge.amount),
      })),
    } : null,
  }
}

export async function startInvestmentScan(imageFile: File): Promise<{ scanId: string; status: string }> {
  const formData = await scanFormData(imageFile)
  const response = await apiFetch('/ocr/scan-investment/jobs', { method: 'POST', body: formData })
  if (!response.ok) await throwApiError(response, 'Could not start investment scan. Please try again.')
  return response.json()
}

type WireInvestmentScanJob = Omit<InvestmentScanJob, 'result'> & {
  result: (Omit<InvestmentActivityScanResult, 'units' | 'unitPrice' | 'cashAmount' | 'fees' | 'taxes' | 'toAmount'> & {
    units: string | number | null
    unitPrice: string | number | null
    cashAmount: string | number | null
    fees: string | number | null
    taxes: string | number | null
    toAmount?: string | number | null
  }) | null
}

export async function fetchInvestmentScanJob(scanId: string): Promise<InvestmentScanJob> {
  const job = await request<WireInvestmentScanJob>(`/ocr/scan-receipt/jobs/${scanId}`, {
    errorMessage: 'Could not fetch investment scan status.',
  })
  const decode = (value: string | number | null) => value == null ? null : deobfuscateAmount(value)
  return {
    ...job,
    result: job.result ? {
      ...job.result,
      units: decode(job.result.units),
      unitPrice: decode(job.result.unitPrice),
      cashAmount: decode(job.result.cashAmount),
      fees: decode(job.result.fees),
      taxes: decode(job.result.taxes),
      toAmount: decode(job.result.toAmount ?? null),
    } : null,
  }
}
