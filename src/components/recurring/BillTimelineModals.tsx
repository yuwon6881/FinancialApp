import React from 'react'
import { CheckCircle2, AlertCircle, Ban, List } from 'lucide-react'
import type { ActiveRecurringPayment } from '../../types'
import { getCategoryBadgeClass, getCategoryDotClass } from '../../lib/categoryColors'
import { getOccurrenceStatusLabel } from './formatters'
import { getBillTimelineAmount, type BillTimelineNode } from '../../lib/billTimeline'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'

export interface BillTimelineModalsProps {
  selectedNode: BillTimelineNode | null
  setSelectedNode: (node: BillTimelineNode | null) => void
  selectedBill: ActiveRecurringPayment | null
  setSelectedBill: (bill: ActiveRecurringPayment | null) => void
  formatTimelineAmount: (value: number | null) => React.ReactNode
  formatSensitive: (value: number) => React.ReactNode
}

export const BillTimelineModals: React.FC<BillTimelineModalsProps> = ({
  selectedNode,
  setSelectedNode,
  selectedBill,
  setSelectedBill,
  formatTimelineAmount,
  formatSensitive,
}) => {
  return (
    <>
      {/* Multiple Bills Selection Bottom Sheet */}
      {selectedNode && (
        <BottomSheet
          isOpen={!!selectedNode}
          onClose={() => setSelectedNode(null)}
          maxWidthClassName="max-w-md"
          title={
            <div className="flex items-center gap-2">
              <List className="size-4 text-blue-500" />
              <span>Subscriptions on {selectedNode.dueDate}</span>
            </div>
          }
        >
          <div className="space-y-2 mt-2">
            {selectedNode.bills.map((bill) => {
              const statusStyle = bill.status === 'Paid' || bill.status === 'SettledByLoanPayoff'
                ? 'text-emerald-500 bg-emerald-500/10'
                : bill.status === 'PartiallyPaid'
                  ? 'text-blue-500 bg-blue-500/10'
                  : bill.status === 'Discarded'
                    ? 'text-slate-400 bg-slate-500/10'
                    : 'text-amber-500 bg-amber-500/10'

              return (
                <Button variant="tertiary"
                  key={bill.id}
                  type="button"
                  onClick={() => {
                    setSelectedNode(null)
                    setSelectedBill(bill)
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/40 transition text-left cursor-pointer"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-foreground">{bill.name}</div>
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-semibold text-xs ${getCategoryBadgeClass(bill.ledgerCategory)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${getCategoryDotClass(bill.ledgerCategory)}`} />
                        {bill.ledgerCategory}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-semibold text-xs ${getCategoryBadgeClass(bill.category)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${getCategoryDotClass(bill.category)}`} />
                        {bill.category}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-right font-semibold">
                    <span className="text-xs font-extrabold text-foreground">{formatTimelineAmount(getBillTimelineAmount(bill))}</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${statusStyle}`}>
                      {getOccurrenceStatusLabel(bill.status)}
                    </span>
                  </div>
                </Button>
              )
            })}
          </div>
        </BottomSheet>
      )}

      {/* Bill Detail Read-Only Modal Overlay */}
      {selectedBill && (
        <BottomSheet
          isOpen={!!selectedBill}
          onClose={() => setSelectedBill(null)}
          maxWidthClassName="max-w-sm"
          title={
            <div className="flex items-center gap-2">
              <span className={`p-1.5 rounded-lg ${
                selectedBill.status === 'Paid' || selectedBill.status === 'SettledByLoanPayoff'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : selectedBill.status === 'PartiallyPaid'
                    ? 'bg-blue-500/10 text-blue-500'
                    : selectedBill.status === 'Discarded'
                      ? 'bg-slate-500/10 text-slate-400'
                      : 'bg-amber-500/10 text-amber-500'
              }`}>
                {selectedBill.status === 'Paid' || selectedBill.status === 'SettledByLoanPayoff' ? (
                  <CheckCircle2 className="size-4" />
                ) : selectedBill.status === 'Discarded' ? (
                  <Ban className="size-4" />
                ) : (
                  <AlertCircle className="size-4" />
                )}
              </span>
              <span className="text-sm font-bold">{selectedBill.name}</span>
            </div>
          }
        >
          <div className="text-xs space-y-3 font-semibold text-foreground">
            <div className="grid grid-cols-2 gap-3.5 bg-muted/30 p-3.5 rounded-xl border border-border/40">
              <div className="flex flex-col justify-between">
                <span className="text-xs text-muted-foreground block font-normal uppercase tracking-wider mb-1">Amount</span>
                <div className="flex items-center min-h-[22px]">
                  <span className="text-base font-extrabold text-foreground leading-none">{selectedBill.amount == null ? 'Unavailable' : formatSensitive(Math.abs(selectedBill.amount))}</span>
                </div>
              </div>
              <div className="flex flex-col justify-between">
                <span className="text-xs text-muted-foreground block font-normal uppercase tracking-wider mb-1">Status</span>
                <div className="flex items-center min-h-[22px]">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold leading-none ${
                    selectedBill.status === 'Paid' || selectedBill.status === 'SettledByLoanPayoff'
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : selectedBill.status === 'PartiallyPaid'
                        ? 'bg-blue-500/10 text-blue-500'
                        : selectedBill.status === 'Discarded'
                          ? 'bg-slate-500/10 text-slate-400 line-through'
                          : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {selectedBill.status === 'PartiallyPaid'
                      ? 'Part paid'
                      : selectedBill.status === 'SettledByLoanPayoff'
                        ? 'Paid off'
                        : selectedBill.status}
                  </span>
                </div>
              </div>
              <div className="flex flex-col justify-between pt-2.5 border-t border-border/30">
                <span className="text-xs text-muted-foreground block font-normal uppercase tracking-wider mb-1">Due Date</span>
                <div className="flex items-center min-h-[22px]">
                  <span className="text-xs font-semibold text-foreground leading-none">{selectedBill.dueDate}</span>
                </div>
              </div>
              <div className="flex flex-col justify-between pt-2.5 border-t border-border/30">
                <span className="text-xs text-muted-foreground block font-normal uppercase tracking-wider mb-1">Categories</span>
                <div className="flex flex-wrap items-center gap-1 min-h-[22px]">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-semibold leading-none ${getCategoryBadgeClass(selectedBill.ledgerCategory)}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getCategoryDotClass(selectedBill.ledgerCategory)}`} />
                    {selectedBill.ledgerCategory}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-semibold leading-none ${getCategoryBadgeClass(selectedBill.category)}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${getCategoryDotClass(selectedBill.category)}`} />
                    {selectedBill.category}
                  </span>
                </div>
              </div>
            </div>

            {selectedBill.status === 'PartiallyPaid' && (
              <div className="grid grid-cols-2 gap-2 bg-blue-500/10 border border-blue-500/20 p-2.5 rounded-xl text-xs">
                <div>
                  <span className="text-eyebrow uppercase text-muted-foreground block">Paid so far</span>
                  <span className="font-extrabold text-foreground">{formatSensitive(selectedBill.paidAmount ?? 0)}</span>
                </div>
                <div>
                  <span className="text-eyebrow uppercase text-muted-foreground block">Still to pay</span>
                  <span className="font-extrabold text-blue-600 dark:text-blue-400">{formatSensitive(selectedBill.remainingAmount ?? 0)}</span>
                </div>
              </div>
            )}

            {selectedBill.paidDate && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
                <span className="text-eyebrow uppercase">Paid On</span>
                <span className="font-extrabold">{selectedBill.paidDate}</span>
              </div>
            )}

            <div className="pt-2">
              <Button variant="secondary"
                onClick={() => setSelectedBill(null)}
                className="min-h-11 w-full rounded-xl"
              >
                Close
              </Button>
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  )
}
