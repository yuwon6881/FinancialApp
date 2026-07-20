import { useState } from 'react'
import { CustomSelect } from './CustomSelect'

/**
 * Replacement-category picker embedded in the "Delete Category" confirmation.
 * Holds its own selection state and reports it upward so the modal can gate the
 * delete/transfer button on a choice being made.
 */
export const CategoryReplacementSelect = ({
  options,
  onChange,
}: {
  options: Array<{ id: string; name: string }>
  onChange: (value: string) => void
}) => {
  const [value, setValue] = useState('')
  return (
    <CustomSelect
      ariaLabel="Replacement category"
      value={value}
      onChange={nextValue => {
        const selected = String(nextValue)
        setValue(selected)
        onChange(selected)
      }}
      options={[
        { value: '', label: 'Choose replacement category' },
        ...options.map(option => ({ value: option.id, label: option.name }))
      ]}
      className="w-full"
    />
  )
}
