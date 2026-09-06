import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export function ModalActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end',
        '[&>*]:w-full sm:[&>*]:w-auto',
        // A modal footer action keeps the full 44px target at every tier. The control scale drops
        // to 40px at the expanded tier, which is right for a dense toolbar and reads as a squat
        // sliver next to a 44px field in a dialog -- the one place a decision is being confirmed.
        '[&>button]:min-h-11',
        className,
      )}
      {...props}
    />
  )
}
