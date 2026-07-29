import { useCallback, useState, type ChangeEvent, type FormEvent } from 'react'
import type { SavingsGoal } from '../../types'
import { maskCurrencyInput } from '../../lib/utils'
import { useFormDraft } from '../../lib/useFormDraft'

interface UseSavingsGoalFormOptions {
  goals: SavingsGoal[]
  hideSensitive: boolean
  onAddGoal: (goal: Partial<SavingsGoal>) => Promise<void> | void
  onUpdateGoal: (id: number, goal: SavingsGoal) => Promise<void> | void
  onStartEditPending?: (id: string | null) => void
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
  const [dateInput, setDateInput] = useState(defaultTargetDate)
  const [priorityInput, setPriorityInput] = useState('Medium')
  const [isRecurringInput, setIsRecurringInput] = useState(false)
  const [recurrenceMonthsInput, setRecurrenceMonthsInput] = useState('12')
  const showAddModal = mode === 'add'
  const showEditModal = mode === 'edit'

  const resetFields = useCallback(() => {
    setNameInput('')
    setTargetInput('')
    setDateInput(defaultTargetDate())
    setPriorityInput('Medium')
    setIsRecurringInput(false)
    setRecurrenceMonthsInput('12')
    setErrors({})
  }, [])

  const openAdd = useCallback(() => {
    resetFields()
    setEditingGoal(null)
    setMode('add')
  }, [resetFields])

  const openEdit = useCallback((goal: SavingsGoal) => {
    if (options.hideSensitive) return
    setEditingGoal(goal)
    setNameInput(goal.name)
    setTargetInput(goal.targetAmount.toFixed(2))
    setDateInput(goal.targetDate)
    setPriorityInput(goal.priority)
    setIsRecurringInput(goal.isRecurring)
    setRecurrenceMonthsInput(String(goal.recurrenceMonths || 12))
    setErrors({})
    options.onStartEditPending?.(String(goal.id))
    setMode('edit')
  }, [options.hideSensitive, options.onStartEditPending])

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
      setDateInput(draft.dateInput)
      setPriorityInput(draft.priorityInput)
      setIsRecurringInput(draft.isRecurringInput)
      setRecurrenceMonthsInput(draft.recurrenceMonthsInput)
      setMode('add')
    },
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
      setDateInput(draft.dateInput)
      setPriorityInput(draft.priorityInput)
      setIsRecurringInput(draft.isRecurringInput)
      setRecurrenceMonthsInput(draft.recurrenceMonthsInput)
      options.onStartEditPending?.(String(goal.id))
      setMode('edit')
    },
  )

  const closeAdd = useCallback(() => {
    clearAddDraft()
    close()
  }, [clearAddDraft, close])
  const closeEdit = useCallback(() => {
    clearEditDraft()
    close()
  }, [clearEditDraft, close])

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

    // A lowered target releases the surplus, which is reasonable — but it should not be a surprise.
    if (editingGoal && Number.isFinite(target) && target < editingGoal.earmarkedAmount) {
      nextErrors.target = `Below the amount already set aside. Saving this releases the difference back to your free rewards.`
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
      ? { target, recurrence: isRecurringInput ? recurrence : 12 }
      : null
  }

  const saveAdd = async (event: FormEvent) => {
    event.preventDefault()
    const valid = validate()
    if (!valid) return
    const goal: Partial<SavingsGoal> = {
      name: nameInput.trim(),
      targetAmount: valid.target,
      targetDate: dateInput,
      priority: priorityInput,
      isRecurring: isRecurringInput,
      recurrenceMonths: valid.recurrence,
    }
    closeAdd()
    await options.onAddGoal(goal)
  }

  const saveEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editingGoal) return
    const valid = validate()
    if (!valid) return
    const goal: SavingsGoal = {
      ...editingGoal,
      name: nameInput.trim(),
      targetAmount: valid.target,
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
