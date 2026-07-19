import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle } from 'lucide-react'
import { listContainerVariants, listItemVariants, listItemExit } from '../../lib/animations'
import type { PendingNotification } from '../../types'
import { Button } from '../ui/Button'
import { DatePicker } from '../ui/DatePicker'
import { SwipeableRow } from '../ui/SwipeableRow'
import { CustomConfirmModal } from '../ui/CustomConfirmModal'
import { getCategoryBadgeClass } from '../../lib/categoryColors'

interface PendingNotificationsCardProps {
  notifications: PendingNotification[] | undefined
  formatSensitive: (val: number) => React.ReactNode
  onConfirmSubscription: (noti: PendingNotification, paidDate: string) => void
  onDiscardSubscription?: (noti: PendingNotification) => void
  onDeletePayment: (id: string) => void
}

export const PendingNotificationsCard: React.FC<PendingNotificationsCardProps> = ({
  notifications,
  formatSensitive,
  onConfirmSubscription,
  onDiscardSubscription,
  onDeletePayment,
}) => {
  const [notiToDelete, setNotiToDelete] = useState<PendingNotification | null>(null)

  // Subscription Confirmation States
  const [activeConfirmId, setActiveConfirmId] = useState<string | null>(null)
  const [paidDateInput, setPaidDateInput] = useState('')

  return (
    <>
      {/* Pending Subscriptions Notifications Alert */}
      {notifications && notifications.length > 0 && (
        <div className="app-panel p-5 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-2.5 mb-2.5">
            <AlertCircle className="size-5 shrink-0 text-yellow-500" />
            <h4 className="text-sm font-bold text-foreground">Pending Subscription Confirmations</h4>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            You have {notifications.length} subscription billing cycle{notifications.length > 1 ? 's' : ''} awaiting confirmation.
          </p>
          <motion.div
            initial="hidden" animate="show"
            variants={listContainerVariants}
            className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3"
          >
            <AnimatePresence>
            {notifications.map((noti) => {
              const isConfirming = activeConfirmId === noti.id
              const notificationBody = (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className="font-bold text-foreground text-xs truncate block">{noti.name}</span>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className={`inline-block text-[9px] px-1.5 py-0.5 font-bold rounded border ${getCategoryBadgeClass(noti.category)}`}>
                        {noti.category}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{noti.billingDate}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-orange-500 font-extrabold text-xs block">
                      -{formatSensitive(noti.amount)}
                    </span>
                    <span className="text-[9px] text-muted-foreground whitespace-nowrap">{noti.cycleLabel}</span>
                  </div>
                </div>
              )
              const startConfirm = () => {
                setActiveConfirmId(noti.id)
                setPaidDateInput(noti.billingDate)
              }
              const dashboardActions = (
                <>
                  <button
                    onClick={startConfirm}
                    className="flex-1 min-h-[44px] min-w-[44px] px-2 flex items-center justify-center bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[10px] font-extrabold transition cursor-pointer"
                  >
                    Pay
                  </button>
                  {onDiscardSubscription && (
                    <button
                      onClick={() => onDiscardSubscription(noti)}
                      className="flex-1 min-h-[44px] min-w-[44px] px-2 flex items-center justify-center bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white text-[10px] font-extrabold transition cursor-pointer"
                    >
                      Skip
                    </button>
                  )}
                  <button
                    onClick={() => setNotiToDelete(noti)}
                    className="flex-1 min-h-[44px] min-w-[44px] px-2 flex items-center justify-center bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-[10px] font-extrabold transition cursor-pointer"
                  >
                    Remove
                  </button>
                </>
              )
              const dashboardDesktopActions = (
                <>
                  <button
                    onClick={startConfirm}
                    className="px-2.5 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-500 font-bold text-[10px] rounded-lg transition duration-150 cursor-pointer text-center whitespace-nowrap"
                  >
                    Pay
                  </button>
                  {onDiscardSubscription && (
                    <button
                      onClick={() => onDiscardSubscription(noti)}
                      className="px-2.5 py-1.5 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 font-bold text-[10px] rounded-lg transition duration-150 cursor-pointer text-center whitespace-nowrap"
                    >
                      Skip
                    </button>
                  )}
                  <button
                    onClick={() => setNotiToDelete(noti)}
                    className="px-2.5 py-1.5 bg-orange-500/5 hover:bg-orange-500/10 text-orange-500 font-semibold text-[10px] rounded-lg transition duration-150 cursor-pointer border border-orange-500/10 text-center whitespace-nowrap"
                  >
                    Remove
                  </button>
                </>
              )
              return (
                <motion.div
                  key={noti.id}
                  variants={listItemVariants}
                  exit={listItemExit}
                  className={isConfirming ? "p-3.5 rounded-xl bg-card border border-border/40 shadow-xs flex flex-col justify-between gap-3" : "rounded-xl"}
                >
                  {isConfirming ? (
                    <div className="flex flex-col gap-2 p-2 bg-muted/30 border border-border/40 rounded-lg animate-in slide-in-from-bottom-2 duration-200">
                      {notificationBody}
                      <label className="text-[10px] font-bold text-muted-foreground">Select Paid Date:</label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <DatePicker
                          value={paidDateInput}
                          onChange={setPaidDateInput}
                          className="w-full sm:flex-1"
                        />
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button
                            size="sm"
                            onClick={() => {
                              onConfirmSubscription(noti, paidDateInput)
                              setActiveConfirmId(null)
                            }}
                            className="flex-1 sm:flex-initial text-xs"
                          >
                            Confirm
                          </Button>
                          <button
                            onClick={() => setActiveConfirmId(null)}
                            className="flex-1 sm:flex-initial px-2.5 py-1.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg text-xs font-semibold cursor-pointer transition border border-border text-center"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <SwipeableRow
                      className="rounded-xl border border-border/40 bg-card"
                      contentClassName="p-3.5"
                      actionsWidth={168}
                      actions={dashboardActions}
                      desktopActions={dashboardDesktopActions}
                    >
                      {notificationBody}
                    </SwipeableRow>
                  )}
                </motion.div>
              )
            })}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      <CustomConfirmModal
        isOpen={!!notiToDelete}
        title="Remove Subscription"
        message="Are you sure you want to delete this recurring subscription? This will cancel all future notifications for this subscription."
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={() => {
          if (notiToDelete) {
            onDeletePayment(notiToDelete.recurringPaymentId)
            setNotiToDelete(null)
          }
        }}
        onCancel={() => setNotiToDelete(null)}
      />
    </>
  )
}
