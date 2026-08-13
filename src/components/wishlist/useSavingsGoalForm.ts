import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import type { SavingsGoal, SavingsGoalFundingBucket } from '../../types'
import { isSavingsGoalFundingBucket } from '../../lib/ledgerCategories'
import { maskCurrencyInput } from '../../lib/utils'
import { useFormDraft } from '../../lib/useFormDraft'
import { focusFirstInvalidField } from '../ui/formValidation'

interface UseSavingsGoalFormOptions {
  goals: SavingsGoal[]
  hideSensitive: boolean
  onAddGoal: (goal: Partial<SavingsGoal>) => Promise<void> | void
  onUpdateGoal: (id: number, goal: SavingsGoal) => Promise<void> | void
  onStartEditPending?: (id: string | null) => void
  aiDraft?: { nonce: number; fields: Record<string, unknown> } | null
  aiEditDraft?: { nonce: number; id: number; changes: Record<string, unknown> } | null
  onAiDraftConsumed?: () => void
  onAiEditDraftConsumed?: () => void
}

// Six years out is a reasonable default horizon for a "someday" fund and keeps the date picker
// from opening on today (which would be an immediately-overdue goal).
function defaultTargetDate(): string {
  const date = new Date()
  date.setMonth(date.getMonth() + 6)
  return date.toLocaleDateString('en-CA')
}

/**
 * Add/edit form state for a savings goal. Mirrors useWishlistForm — including the draft
 * persistence so a half-typed goal survives a background/foreground cycle on mobile.
 */
export function useSavingsGoalForm(options: UseSavingsGoalFormOptions) {
  const [mode, setMode] = useState<'add' | 'edit' | null>(null)
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [nameInput, setNameInput] = useState('')
  const [targetInput, setTargetInput] = useState('')
  const [fundingBucketInput, setFundingBucketInput] = useState<SavingsGoalFundingBucket>('Rewards')
  const [dateInput, setDateInput] = useState(defaultTargetDate)
  const [priorityInput, setPriorityInput] = useState('Medium')
  const [isRecurringInput, setIsRecurringInput] = useState(false)
  const [recurrenceMonthsInput, setRecurrenceMonthsInput] = useState('12')
  const showAddModal = mode === 'add'
  const showEditModal = mode === 'edit'

  const readText = (fields: Record<string, unknown>, key: string, fallback: string) =>
    typeof fields[key] === 'string' && fields[key].trim() ? fields[key].trim() : fallback
  const readNumber = (fields: Record<string, unknown>, key: string, fallback: string) =>
    typeof fields[key] === 'number' && Number.isFinite(fields[key]) ? String(fields[key]) : readText(fields, key, fallback)
  const readBoolean = (fields: Record<string, unknown>, key: string, fallback: boolean) =>
    typeof fields[key] === 'boolean' ? fields[key] as boolean : fallback
  const normalizePriority = (value: string) => {
    const lower = value.toLowerCase()
    return lower === 'high' ? 'High' : lower === 'low' ? 'Low' : 'Medium'
  }
  const normalizeFundingBucket = (value: string): SavingsGoalFundingBucket =>
    isSavingsGoalFundingBucket(value) ? value : 'Rewards'

  const resetFields = useCallback(() => {
    setNameInput('')
    setTargetInput('')
    setFundingBucketInput('Rewards')
    setDateInput(defaultTargetDate())
    setPriorityInput('Medium')
    setIsRecurringInput(false)
    setRecurrenceMonthsInput('12')
    setErrors({})
  }, [])

  const openAdd = useCallback(() => {
    if (options.hideSensitive) return
    resetFields()
    setEditingGoal(null)
    setMode('add')
  }, [options.hideSensitive, resetFields])

  const openEdit = useCallback((goal: SavingsGoal) => {
    if (options.hideSensitive) return
    setEditingGoal(goal)
    setNameInput(goal.name)
    setTargetInput(goal.targetAmount.toFixed(2))
    setFundingBucketInput(normalizeFundingBucket(goal.fundingBucket ?? 'Rewards'))
    setDateInput(goal.targetDate)
    setPriorityInput(goal.priority)
    setIsRecurringInput(goal.isRecurring)
    setRecurrenceMonthsInput(String(goal.recurrenceMonths || 12))
    setErrors({})
    options.onStartEditPending?.(String(goal.id))
    setMode('edit')
  }, [options.hideSensitive, options.onStartEditPending])

  useEffect(() => {
    if (!options.aiDraft) return
    if (options.hideSensitive) {
      options.onAiDraftConsumed?.()
      return
    }
    const fields = options.aiDraft.fields
    resetFields()
    setNameInput(readText(fields, 'name', ''))
    setTargetInput(readNumber(fields, 'targetAmount', ''))
    setFundingBucketInput(normalizeFundingBucket(readText(fields, 'fundingBucket', 'Rewards')))
    setDateInput(readText(fields, 'targetDate', defaultTargetDate()))
    setPriorityInput(normalizePriority(readText(fields, 'priority', 'Medium')))
    setIsRecurringInput(readBoolean(fields, 'isRecurring', false))
    setRecurrenceMonthsInput(readNumber(fields, 'recurrenceMonths', '12'))
    setMode('add')
    options.onAiDraftConsumed?.()
  }, [options.aiDraft, options.onAiDraftConsumed, resetFields])

  useEffect(() => {
    if (!options.aiEditDraft || options.hideSensitive) return
    const goal = options.goals.find(candidate => candidate.id === options.aiEditDraft?.id)
    if (!goal) {
      options.onAiEditDraftConsumed?.()
      return
    }
    const changes = options.aiEditDraft.changes
    setEditingGoal(goal)
    setNameInput(readText(changes, 'name', goal.name))
    setTargetInput(readNumber(changes, 'targetAmount', goal.targetAmount.toFixed(2)))
    setFundingBucketInput(normalizeFundingBucket(readText(changes, 'fundingBucket', goal.fundingBucket ?? 'Rewards')))
    setDateInput(readText(changes, 'targetDate', goal.targetDate))
    setPriorityInput(normalizePriority(readText(changes, 'priority', goal.priority)))
    setIsRecurringInput(readBoolean(changes, 'isRecurring', goal.isRecurring))
    setRecurrenceMonthsInput(readNumber(changes, 'recurrenceMonths', String(goal.recurrenceMonths || 12)))
    setErrors({})
    options.onStartEditPending?.(String(goal.id))
    setMode('edit')
    options.onAiEditDraftConsumed?.()
  }, [options.aiEditDraft, options.goals, options.hideSensitive, options.onAiEditDraftConsumed, options.onStartEditPending])

  const close = useCallback(() => {
    if (mode === 'edit') options.onStartEditPending?.(null)
    setMode(null)
    setEditingGoal(null)
    resetFields()
  }, [mode, options.onStartEditPending, resetFields])

  const draftFields = {
    nameInput,
    targetInput,
    dateInput,
    fundingBucketInput,
    priorityInput,
    isRecurringInput,
    recurrenceMonthsInput,
  }

  const { clearDraft: clearAddDraft } = useFormDraft(
    'savings-goal-add',
    showAddModal,
    draftFields,
    draft => {
      setNameInput(draft.nameInput)
      setTargetInput(draft.targetInput)
      setFundingBucketInput(draft.fundingBucketInput)
      setDateInput(draft.dateInput)
      setPriorityInput(draft.priorityInput)
      setIsRecurringInput(draft.isRecurringInput)
      setRecurrenceMonthsInput(draft.recurrenceMonthsInput)
      setMode('add')
    },
    { restoreOnMount: false },
  )
  const { clearDraft: clearEditDraft } = useFormDraft(
    'savings-goal-edit',
    showEditModal,
    { editingGoalId: editingGoal?.id ?? null, ...draftFields },
    draft => {
      if (draft.editingGoalId == null) return
      const goal = options.goals.find(candidate => String(candidate.id) === String(draft.editingGoalId))
      if (!goal) return
      setEditingGoal(goal)
      setNameInput(draft.nameInput)
      setTargetInput(draft.targetInput)
      setFundingBucketInput(draft.fundingBucketInput)
      setDateInput(draft.dateInput)
      setPriorityInput(draft.priorityInput)
      setIsRecurringInput(draft.isRecurringInput)
      setRecurrenceMonthsInput(draft.recurrenceMonthsInput)
      options.onStartEditPending?.(String(goal.id))
      setMode('edit')
    },
    { restoreOnMount: false },
  )

  const closeAdd = useCallback(() => {
    clearAddDraft()
    close()
  }, [clearAddDraft, close])
  const closeEdit = useCallback(() => {
    clearEditDraft()
    close()
  }, [clearEditDraft, close])

  useEffect(() => {
    if (!options.hideSensitive) return
    if (mode === 'add') closeAdd()
    if (mode === 'edit') closeEdit()
  }, [options.hideSensitive, mode, closeAdd, closeEdit])

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    if (!nameInput.trim()) nextErrors.name = 'Goal name is required.'

    const target = Number.parseFloat(targetInput)
    if (!targetInput.trim()) nextErrors.target = 'Target amount is required.'
    else if (!Number.isFinite(target) || target <= 0) nextErrors.target = 'Please enter a valid amount greater than 0.'

    if (!dateInput.trim()) {
      nextErrors.date = 'Target date is required.'
    } else if (editingGoal === null && dateInput < new Date().toLocaleDateString('en-CA')) {
      // Only enforced on create. An existing goal is allowed to keep a past deadline so the UI can
      // show it as overdue rather than forcing the user to move the goalposts to save an edit.
      nextErrors.date = 'Pick a date in the future.'
    }

    const recurrence = Number.parseInt(recurrenceMonthsInput, 10)
    if (isRecurringInput && (!Number.isFinite(recurrence) || recurrence < 1 || recurrence > 120)) {
      nextErrors.recurrence = 'Repeat every 1–120 months.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
      ? { target, recurrence: isRecurringInput ? recurrence : 12 }
      : null
  }

  const saveAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (options.hideSensitive) return
    const valid = validate()
    if (!valid) {
      focusFirstInvalidField(event.currentTarget)
      return
    }
    const goal: Partial<SavingsGoal> = {
      name: nameInput.trim(),
      targetAmount: valid.target,
      fundingBucket: fundingBucketInput,
      targetDate: dateInput,
      priority: priorityInput,
      isRecurring: isRecurringInput,
      recurrenceMonths: valid.recurrence,
    }
    closeAdd()
    await options.onAddGoal(goal)
  }

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (options.hideSensitive) return
    if (!editingGoal) return
    const valid = validate()
    if (!valid) {
      focusFirstInvalidField(event.currentTarget)
      return
    }
    const goal: SavingsGoal = {
      ...editingGoal,
      name: nameInput.trim(),
      targetAmount: valid.target,
      fundingBucket: fundingBucketInput,
      targetDate: dateInput,
      priority: priorityInput,
      isRecurring: isRecurringInput,
      recurrenceMonths: valid.recurrence,
    }
    delete goal.isPendingSync
    const id = editingGoal.id
    closeEdit()
    await options.onUpdateGoal(id, goal)
  }

  const handleTargetChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTargetInput(previous => maskCurrencyInput(event.target.value, previous))
  }

  // Lowering the target below what is already set aside releases the surplus — the server does
  // exactly that (SavingsGoalService.UpdateGoalAsync clamps the earmark and reopens the cycle
  // tally). It is a consequence to state, never a reason to refuse the save: as a validation error
  // it blocked the only path to the behaviour its own message described, so a goal's target could
  // never be lowered once money had gone in.
  const target = Number.parseFloat(targetInput)
  const releasedByLowerTarget = editingGoal && Number.isFinite(target) && target < editingGoal.earmarkedAmount
    ? editingGoal.earmarkedAmount - target
    : 0

  return {
    showAddModal,
    showEditModal,
    editingGoal,
    errors,
    setErrors,
    nameInput,
    setNameInput,
    targetInput,
    handleTargetChange,
    fundingBucketInput,
    setFundingBucketInput,
    releasedByLowerTarget,
    dateInput,
    setDateInput,
    priorityInput,
    setPriorityInput,
    isRecurringInput,
    setIsRecurringInput,
    recurrenceMonthsInput,
    setRecurrenceMonthsInput,
    handleOpenAddModal: openAdd,
    handleOpenEditModal: openEdit,
    closeAddModal: closeAdd,
    closeEditModal: closeEdit,
    handleSaveAdd: saveAdd,
    handleSaveEdit: saveEdit,
  }
}
