import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import type { WishlistItem } from '../../types'
import { maskCurrencyInput } from '../../lib/utils'
import { useAutoOpenModal } from '../../lib/useAutoOpenModal'
import { useFormDraft } from '../../lib/useFormDraft'
import { focusFirstInvalidField } from '../ui/formValidation'
import type { SensitivePreferenceStatus } from '../../app/useAppPreferences'

interface UseWishlistFormOptions {
  wishlist: WishlistItem[]
  hideSensitive: boolean
  sensitivePreferenceStatus?: SensitivePreferenceStatus
  autoOpenAddModal?: boolean
  onResetAutoOpen?: () => void
  onAddItem: (item: Partial<WishlistItem>) => Promise<void> | void
  onUpdateItem: (id: number, item: WishlistItem) => Promise<void> | void
  onStartEditPending?: (id: string | null) => void
  aiDraft?: { nonce: number; fields: Record<string, unknown> } | null
  aiEditDraft?: { nonce: number; id: number; changes: Record<string, unknown> } | null
  onAiDraftConsumed?: () => void
  onAiEditDraftConsumed?: () => void
}

export function useWishlistForm(options: UseWishlistFormOptions) {
  const [mode, setMode] = useState<'add' | 'edit' | null>(null)
  const [editingItem, setEditingItem] = useState<WishlistItem | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [nameInput, setNameInput] = useState('')
  const [priceInput, setPriceInput] = useState('')
  const [priorityInput, setPriorityInput] = useState('Medium')
  const [isActiveInput, setIsActiveInput] = useState(false)
  const showAddModal = mode === 'add'
  const showEditModal = mode === 'edit'
  const canOpenWhilePrivacyPending = options.sensitivePreferenceStatus === 'pending'

  const applyAiFields = useCallback((fields: Record<string, unknown>) => {
    const text = (key: string) => typeof fields[key] === 'string' && (fields[key] as string).trim()
      ? (fields[key] as string).trim()
      : null
    const amount = fields.price
    const price = typeof amount === 'number' && Number.isFinite(amount)
      ? amount
      : typeof amount === 'string' && amount.trim() && Number.isFinite(Number(amount))
        ? Number(amount)
        : null
    const name = text('name')
    if (name !== null) setNameInput(name)
    if (price !== null) setPriceInput(Math.abs(price).toFixed(2))
    const priority = text('priority')
    if (priority === 'High' || priority === 'Medium' || priority === 'Low') setPriorityInput(priority)
    if (typeof fields.isActive === 'boolean') setIsActiveInput(fields.isActive)
  }, [])

  const resetFields = useCallback(() => {
    setNameInput('')
    setPriceInput('')
    setPriorityInput('Medium')
    setIsActiveInput(false)
    setErrors({})
  }, [])

  const openAdd = useCallback(() => {
    if (options.hideSensitive && !canOpenWhilePrivacyPending) return
    resetFields()
    setEditingItem(null)
    setIsActiveInput(options.wishlist.every(item => item.isPurchased))
    setMode('add')
  }, [options.hideSensitive, canOpenWhilePrivacyPending, options.wishlist, resetFields])

  const openEdit = useCallback((item: WishlistItem) => {
    if (options.hideSensitive) return
    setEditingItem(item)
    setNameInput(item.name)
    setPriceInput(item.price.toFixed(2))
    setPriorityInput(item.priority)
    setIsActiveInput(item.isActive)
    options.onStartEditPending?.(String(item.id))
    setMode('edit')
  }, [options.hideSensitive, options.onStartEditPending])

  const close = useCallback(() => {
    if (mode === 'edit') options.onStartEditPending?.(null)
    setMode(null)
    setEditingItem(null)
    resetFields()
  }, [mode, options.onStartEditPending, resetFields])

  const { clearDraft: clearAddDraft } = useFormDraft(
    'wishlist-add',
    showAddModal,
    { nameInput, priceInput, priorityInput, isActiveInput },
    draft => {
      setNameInput(draft.nameInput)
      setPriceInput(draft.priceInput)
      setPriorityInput(draft.priorityInput)
      setIsActiveInput(draft.isActiveInput)
      setMode('add')
    },
  )
  const { clearDraft: clearEditDraft } = useFormDraft(
    'wishlist-edit',
    showEditModal,
    { editingItemId: editingItem?.id ?? null, nameInput, priceInput, priorityInput, isActiveInput },
    draft => {
      if (draft.editingItemId == null) return
      const item = options.wishlist.find(candidate => String(candidate.id) === String(draft.editingItemId))
      if (!item) return
      setEditingItem(item)
      setNameInput(draft.nameInput)
      setPriceInput(draft.priceInput)
      setPriorityInput(draft.priorityInput)
      setIsActiveInput(draft.isActiveInput)
      options.onStartEditPending?.(String(item.id))
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

  useEffect(() => {
    if (!options.hideSensitive || canOpenWhilePrivacyPending) return
    if (mode === 'add') closeAdd()
    if (mode === 'edit') closeEdit()
  }, [options.hideSensitive, canOpenWhilePrivacyPending, mode, closeAdd, closeEdit])

  const validate = () => {
    const nextErrors: Record<string, string> = {}
    if (!nameInput.trim()) nextErrors.name = 'Goal name is required.'
    const price = Number.parseFloat(priceInput)
    if (!priceInput.trim()) nextErrors.price = 'Price is required.'
    else if (!Number.isFinite(price) || price <= 0) nextErrors.price = 'Please enter a valid price greater than 0.'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0 ? price : null
  }

  const saveAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (options.hideSensitive) return
    const price = validate()
    if (price == null) {
      focusFirstInvalidField(event.currentTarget)
      return
    }
    const item = { name: nameInput, price, priority: priorityInput, isActive: isActiveInput }
    closeAdd()
    await options.onAddItem(item)
  }

  const saveEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (options.hideSensitive) return
    if (!editingItem) return
    const price = validate()
    if (price == null) {
      focusFirstInvalidField(event.currentTarget)
      return
    }
    const item = { ...editingItem, name: nameInput, price, priority: priorityInput, isActive: isActiveInput }
    delete item.isPendingSync
    const id = editingItem.id
    closeEdit()
    await options.onUpdateItem(id, item)
  }

  const handlePriceChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPriceInput(previous => maskCurrencyInput(event.target.value, previous))
  }

  useAutoOpenModal(options.autoOpenAddModal, openAdd, options.onResetAutoOpen)

  useEffect(() => {
    if (!options.aiDraft) return
    if (options.hideSensitive) {
      options.onAiDraftConsumed?.()
      return
    }
    openAdd()
    applyAiFields(options.aiDraft.fields)
    options.onAiDraftConsumed?.()
  }, [options.aiDraft?.nonce])

  useEffect(() => {
    if (!options.aiEditDraft) return
    if (options.hideSensitive) {
      options.onAiEditDraftConsumed?.()
      return
    }
    const item = options.wishlist.find(candidate => Number(candidate.id) === Number(options.aiEditDraft?.id))
    if (item) {
      openEdit(item)
      applyAiFields(options.aiEditDraft.changes)
    }
    options.onAiEditDraftConsumed?.()
  }, [options.aiEditDraft?.nonce])

  return {
    showAddModal,
    showEditModal,
    editingItem,
    errors,
    setErrors,
    nameInput,
    setNameInput,
    priceInput,
    priorityInput,
    setPriorityInput,
    isActiveInput,
    setIsActiveInput,
    handlePriceChange,
    handleOpenAddModal: openAdd,
    handleOpenEditModal: openEdit,
    closeAddModal: closeAdd,
    closeEditModal: closeEdit,
    handleSaveAdd: saveAdd,
    handleSaveEdit: saveEdit,
  }
}
