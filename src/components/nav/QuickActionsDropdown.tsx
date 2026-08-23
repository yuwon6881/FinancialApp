import React from 'react'
import { Plus } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface QuickActionsDropdownProps {
  onQuickAction?: (action: 'transaction' | 'subscription' | 'wishlist') => void
}

export const QuickActionsDropdown: React.FC<QuickActionsDropdownProps> = ({
  onQuickAction,
}) => {
  return (
    <div className="hidden md:block border border-border/60 rounded-xl bg-background shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger className="h-9 px-2 py-1 sm:px-2.5 text-xs font-semibold hover:bg-muted/50 rounded-lg cursor-pointer flex items-center gap-1 whitespace-nowrap">
          <Plus className="size-3.5 text-blue-500" />
          <span className="hidden xl:inline">Quick Add</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="z-50 min-w-[160px] bg-card border border-border p-1 rounded-xl shadow-md">
          <DropdownMenuItem
            onSelect={() => onQuickAction?.('transaction')}
            className="flex min-h-11 items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer text-foreground sm:min-h-0"
          >
            Post Transaction <Plus className="size-3 text-blue-500" />
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => onQuickAction?.('subscription')}
            className="flex min-h-11 items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer text-foreground sm:min-h-0"
          >
            New Subscription <Plus className="size-3 text-violet-500" />
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => onQuickAction?.('wishlist')}
            className="flex min-h-11 items-center justify-between px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer text-foreground sm:min-h-0"
          >
            Add Reward <Plus className="size-3 text-pink-500" aria-hidden />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
