import { m } from 'framer-motion'
import type { ChangeEvent, FormEvent } from 'react'
import { CustomSelect } from '../ui/CustomSelect'
import { SmartAmountInput } from '../ui/SmartAmountInput'

interface WishlistItemFormProps {
  mode: 'add' | 'edit'
  currency: string
  name: string
  price: string
  priority: string
  isActive: boolean
  errors: Record<string, string>
  onNameChange: (value: string) => void
  onPriceChange: (event: ChangeEvent<HTMLInputElement>) => void
  onPriorityChange: (value: string) => void
  onActiveChange: (value: boolean) => void
  onClearError: (field: string) => void
  onCancel: () => void
  onSubmit: (event: FormEvent) => void
}

export function WishlistItemForm(props: WishlistItemFormProps) {
  const isAdd = props.mode === 'add'
  return (
    <form noValidate onSubmit={props.onSubmit} className="space-y-4 text-xs font-semibold">
      <div>
        <label className="text-muted-foreground block mb-1">Goal Name *</label>
        <input
          type="text"
          value={props.name}
          onChange={event => {
            props.onNameChange(event.target.value)
            props.onClearError('name')
          }}
          placeholder={isAdd ? 'e.g. Mechanical Keyboard, Weekend Trip' : undefined}
          className={`w-full px-3.5 py-2 bg-background border rounded-xl focus:outline-none focus:ring-1 transition font-medium ${
            props.errors.name ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-blue-500'
          }`}
        />
        {props.errors.name && <p className="text-[11px] text-destructive font-medium mt-1">{props.errors.name}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-muted-foreground block mb-1">Price ({props.currency}) *</label>
          <SmartAmountInput
            type="text"
            value={props.price}
            onChange={event => {
              props.onPriceChange(event)
              props.onClearError('price')
            }}
            placeholder={isAdd ? '0.00' : undefined}
            className={`w-full px-3.5 py-2 bg-background border rounded-xl focus:outline-none focus:ring-1 transition font-medium [appearance:textfield] ${
              props.errors.price ? 'border-destructive focus:ring-destructive' : 'border-border focus:ring-blue-500'
            }`}
          />
          {props.errors.price && <p className="text-[11px] text-destructive font-medium mt-1">{props.errors.price}</p>}
        </div>
        <div>
          <label className="text-muted-foreground block mb-1">Priority</label>
          <CustomSelect
            ariaLabel="Goal priority"
            value={props.priority}
            onChange={props.onPriorityChange}
            options={['High', 'Medium', 'Low'].map(value => ({ value, label: value }))}
            className="w-full"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 py-1 select-none">
        <input
          type="checkbox"
          id={`wishlist-active-${props.mode}`}
          checked={props.isActive}
          onChange={event => props.onActiveChange(event.target.checked)}
          className="size-3.5 border-border rounded focus:ring-blue-500"
        />
        <label htmlFor={`wishlist-active-${props.mode}`} className="text-muted-foreground font-medium cursor-pointer">
          Set as Active Focus Goal
        </label>
      </div>

      <div className="flex items-center gap-3 border-t border-border/30 pt-4 mt-6">
        <button type="button" onClick={props.onCancel} className="flex-1 py-2.5 bg-muted text-muted-foreground rounded-xl font-bold cursor-pointer">
          Cancel
        </button>
        <m.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="submit"
          className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full font-bold shadow-lg shadow-blue-500/25 cursor-pointer"
        >
          {isAdd ? 'Add Goal' : 'Save Changes'}
        </m.button>
      </div>
    </form>
  )
}
