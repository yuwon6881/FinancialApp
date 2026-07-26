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

export interface InvestmentActivityScanResult {
  type: 'Buy' | 'Sell' | 'Dividend' | 'FeeTax' | null
  accountId: string | null
  instrumentId: string | null
  tradeDate: string | null
  units: number | null
  unitPrice: number | null
  cashAmount: number | null
  fees: number | null
  taxes: number | null
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

export async function startReceiptScan(imageFile: File): Promise<{ scanId: string; status: string }> {
  const formData = new FormData()
  formData.append('image', imageFile)
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

export async function startInvestmentScan(imageFile: File): Promise<{ scanId: string; status: string }> {
  const formData = new FormData()
  formData.append('image', imageFile)
  const response = await apiFetch('/ocr/scan-investment/jobs', { method: 'POST', body: formData })
  if (!response.ok) await throwApiError(response, 'Could not start investment scan. Please try again.')
  return response.json()
}

type WireInvestmentScanJob = Omit<InvestmentScanJob, 'result'> & {
  result: (Omit<InvestmentActivityScanResult, 'units' | 'unitPrice' | 'cashAmount' | 'fees' | 'taxes'> & {
    units: string | number | null
    unitPrice: string | number | null
    cashAmount: string | number | null
    fees: string | number | null
    taxes: string | number | null
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
    } : null,
  }
}
