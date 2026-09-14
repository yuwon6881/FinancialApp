import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export function ModalActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end',
        '[&>*]:w-full sm:[&>*]:w-auto',
        // A modal footer action keeps the taller 52px target at every tier.
        '[&>button]:min-h-13',
        className,
      )}
      {...props}
    />
  )
}
