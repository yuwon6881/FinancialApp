export type TransactionType = 'inflow' | 'outflow' | 'transfer'
export type TransferBucket = 'Essentials' | 'Growth' | 'Stability' | 'Rewards'
export type SelectableLedgerCategory = 'Income' | TransferBucket

export interface TransactionFormState {
  showAddForm: boolean
  mode: 'create' | 'edit'
  editingId: string | null
  description: string
  amount: string
  transactionType: TransactionType
  category: string
  ledgerCategory: SelectableLedgerCategory
  transferSource: TransferBucket
  transferTarget: TransferBucket
  date: string
  /**
   * Whether the user opted this salary into putting money back into the emergency fund.
   *
   * Reset by every action that opens or repopulates the form, never carried between openings and
   * never persisted with the draft: the offer is a per-salary decision, and an AI draft or a
   * scanned receipt must not arrive with it already ticked.
   */
  stabilityTopUpAccepted: boolean
  /**
   * How much to put back, as typed. Empty means "use the offer's default", so the amount tracks a
   * changing salary until the user overrides it and then stops moving under them.
   */
  stabilityTopUpAmount: string
  errors: Record<string, string>
}

export type TransactionFormAction =
  | { type: 'OPEN_CREATE'; payload?: { defaultCategory: string; todayDate: string } }
  | { type: 'OPEN_EDIT'; payload: { id: string; description: string; amount: string; date: string; category: string; ledgerCategory: string; txType: TransactionType; transferSource?: TransferBucket; transferTarget?: TransferBucket } }
  | { type: 'SET_FIELD'; field: keyof TransactionFormState; value: any }
  | { type: 'APPLY_RECEIPT'; payload: { description?: string; amount?: string; date?: string; txType?: TransactionType; ledgerCategory?: SelectableLedgerCategory; category?: string }; todayDate: string }
  | { type: 'APPLY_AI_DRAFT'; payload: Record<string, any>; todayDate: string }
  | { type: 'RESET'; todayDate: string; defaultCategory: string }
  | { type: 'SET_ERRORS'; errors: Record<string, string> }
  | { type: 'CLOSE' }

export const getInitialState = (todayDate: string, defaultCategory: string): TransactionFormState => ({
  showAddForm: false,
  mode: 'create',
  editingId: null,
  description: '',
  amount: '',
  transactionType: 'outflow',
  category: defaultCategory,
  ledgerCategory: 'Essentials',
  transferSource: 'Essentials',
  transferTarget: 'Rewards',
  date: todayDate,
  stabilityTopUpAccepted: false,
  stabilityTopUpAmount: '',
  errors: {},
})

export function transactionFormReducer(state: TransactionFormState, action: TransactionFormAction): TransactionFormState {
  switch (action.type) {
    case 'OPEN_CREATE':
      return {
        ...state,
        showAddForm: true,
        mode: 'create',
        editingId: null,
        description: '',
        amount: '',
        transactionType: 'outflow',
        ledgerCategory: 'Essentials',
        transferSource: 'Essentials',
        transferTarget: 'Rewards',
        date: action.payload?.todayDate ?? state.date,
        category: action.payload?.defaultCategory ?? state.category,
        stabilityTopUpAccepted: false,
        stabilityTopUpAmount: '',
        errors: {},
      }
    case 'OPEN_EDIT':
      return {
        ...state,
        showAddForm: true,
        mode: 'edit',
        editingId: action.payload.id,
        description: action.payload.description,
        amount: action.payload.amount,
        date: action.payload.date,
        transactionType: action.payload.txType,
        category: action.payload.category,
        ledgerCategory: action.payload.ledgerCategory as SelectableLedgerCategory,
        transferSource: action.payload.transferSource ?? state.transferSource,
        transferTarget: action.payload.transferTarget ?? state.transferTarget,
        stabilityTopUpAccepted: false,
        stabilityTopUpAmount: '',
        errors: {},
      }
    case 'SET_FIELD':
      return {
        ...state,
        [action.field]: action.value,
        errors: { ...state.errors, [action.field]: '' }, // clear error when typing
      }
    case 'APPLY_RECEIPT': {
      const { description, amount, date, txType, ledgerCategory, category } = action.payload
      return {
        ...state,
        description: description ?? state.description,
        amount: amount ?? state.amount,
        date: date ?? action.todayDate,
        transactionType: txType ?? state.transactionType,
        ledgerCategory: ledgerCategory ?? state.ledgerCategory,
        category: category ?? state.category,
        stabilityTopUpAccepted: false,
        stabilityTopUpAmount: '',
        errors: {},
      }
    }
    case 'APPLY_AI_DRAFT': {
      const { fields } = action.payload
      const getString = (key: string) => {
        const value = fields[key]
        return typeof value === 'string' && value.trim() ? value.trim() : null
      }
      const getNumber = (key: string) => {
        const value = fields[key]
        if (typeof value === 'number' && Number.isFinite(value)) return value
        if (typeof value === 'string' && value.trim()) {
          const parsed = Number(value)
          return Number.isFinite(parsed) ? parsed : null
        }
        return null
      }

      const nextDescription = getString('description')
      const nextAmount = getNumber('amount')
      const nextDate = getString('date')
      const nextCategory = getString('category')
      const nextLedgerCategory = getString('ledgerCategory')
      const nextTxType = getString('txType')
      const nextTransferSource = getString('transferSource')
      const nextTransferTarget = getString('transferTarget')

      return {
        ...state,
        description: nextDescription !== null ? nextDescription : state.description,
        amount: nextAmount !== null ? Math.abs(nextAmount).toFixed(2) : state.amount,
        date: nextDate !== null ? nextDate : state.date,
        category: nextCategory !== null ? nextCategory : state.category,
        ledgerCategory: (nextLedgerCategory && ['Income', 'Essentials', 'Growth', 'Stability', 'Rewards'].includes(nextLedgerCategory))
          ? (nextLedgerCategory as SelectableLedgerCategory)
          : state.ledgerCategory,
        transactionType: (nextTxType === 'inflow' || nextTxType === 'outflow' || nextTxType === 'transfer')
          ? nextTxType
          : state.transactionType,
        transferSource: (nextTransferSource && ['Essentials', 'Growth', 'Stability', 'Rewards'].includes(nextTransferSource))
          ? (nextTransferSource as TransferBucket)
          : state.transferSource,
        transferTarget: (nextTransferTarget && ['Essentials', 'Growth', 'Stability', 'Rewards'].includes(nextTransferTarget))
          ? (nextTransferTarget as TransferBucket)
          : state.transferTarget,
        // The assistant does not know how much the user can spare this cycle, so a draft never
        // arrives pre-accepted.
        stabilityTopUpAccepted: false,
        stabilityTopUpAmount: '',
        errors: {},
      }
    }
    case 'RESET':
      return getInitialState(action.todayDate, action.defaultCategory)
    case 'SET_ERRORS':
      return {
        ...state,
        errors: action.errors,
      }
    case 'CLOSE':
      return {
        ...state,
        showAddForm: false,
      }
    default:
      return state
  }
}
