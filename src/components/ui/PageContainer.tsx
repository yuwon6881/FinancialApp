import type { ComponentPropsWithoutRef, ElementType } from 'react'
import { cn } from '../../lib/utils'

type PageContainerProps<T extends ElementType = 'div'> = {
  as?: T
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>

export function PageContainer<T extends ElementType = 'div'>({
  as,
  className,
  ...props
}: PageContainerProps<T>) {
  const Component = as ?? 'div'
  return (
    <Component
      className={cn('mx-auto w-full min-w-0 max-w-[1440px] px-4 sm:px-6 lg:px-8', className)}
      {...props}
    />
  )
}
