import { Input } from '../ui/Input'
import { Checkbox } from '../ui/Checkbox'
import type { ChangeEvent, FormEvent } from 'react'
import { CustomSelect } from '../ui/CustomSelect'
import { SmartAmountInput } from '../ui/SmartAmountInput'
import { FormField } from '../ui/FormField'
import { Button } from '../ui/Button'
import { ModalActions } from '../ui/ModalActions'

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
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function WishlistItemForm(props: WishlistItemFormProps) {
  const isAdd = props.mode === 'add'
  return (
    <form noValidate onSubmit={props.onSubmit} className="space-y-4 text-xs font-semibold">
      <FormField label="Reward name" required error={props.errors.name}>
        <Input
          type="text"
          value={props.name}
          onChange={event => {
            props.onNameChange(event.target.value)
            props.onClearError('name')
          }}
          placeholder={isAdd ? 'e.g. Mechanical Keyboard, Weekend Trip' : undefined}
          className="font-medium"
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label={`Price (${props.currency})`} required error={props.errors.price}>
          <SmartAmountInput
            type="text"
            value={props.price}
            onChange={event => {
              props.onPriceChange(event)
              props.onClearError('price')
            }}
            placeholder={isAdd ? '0.00' : undefined}
            className="font-medium [appearance:textfield]"
          />
        </FormField>
        <FormField label="Priority">
          <CustomSelect
            ariaLabel="Reward priority"
            value={props.priority}
            onChange={props.onPriorityChange}
            options={['High', 'Medium', 'Low'].map(value => ({ value, label: value }))}
            className="w-full"
          />
        </FormField>
      </div>

      <div className="flex items-center gap-2 py-1 select-none">
        <Checkbox
          id={`wishlist-active-${props.mode}`}
          checked={props.isActive}
          onChange={event => props.onActiveChange(event.target.checked)}
          className="size-3.5 border-border rounded focus:ring-ring"
        />
        <label htmlFor={`wishlist-active-${props.mode}`} className="text-muted-foreground font-medium cursor-pointer">
          Focus on this reward first
        </label>
      </div>

      <ModalActions className="border-t border-border/30 pt-4 mt-6">
        <Button variant="outline" type="button" onClick={props.onCancel} className="rounded-xl py-2.5">
          Cancel
        </Button>
        <Button
          type="submit"
          className="rounded-xl py-2.5 shadow-lg shadow-primary/25"
        >
          {isAdd ? 'Add Reward' : 'Save Changes'}
        </Button>
      </ModalActions>
    </form>
  )
}
