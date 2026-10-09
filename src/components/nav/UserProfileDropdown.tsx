import React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ChevronsUpDown,
  Settings,
  Eye,
  EyeOff,
  Sun,
  Moon,
  LogOut,
  Loader2,
} from 'lucide-react'
import type { AppTab } from '../../types'
import type { SensitivePreferenceStatus } from '../../app/useAppPreferences'
import { cn } from '../../lib/utils'

export interface UserProfileDropdownProps {
  username: string
  onTabChange: (tab: AppTab) => void
  hideSensitive: boolean
  sensitivePreferenceStatus: SensitivePreferenceStatus
  onToggleHideSensitive: () => void
  darkMode: boolean
  onToggleDarkMode: () => void
  onLogout: () => void
  /**
   * `avatar` is the round trigger for the phone top bar. `row` is the sidebar footer: avatar, name
   * and a disclosure mark, collapsing to the avatar alone on the icon rail.
   */
  trigger?: 'avatar' | 'row'
  align?: 'start' | 'end'
  side?: 'top' | 'bottom'
}

const getInitials = (name: string) => {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

/** The account monogram: Iris in both themes, so "you" reads the same everywhere. */
const Avatar: React.FC<{ username: string; className?: string }> = ({ username, className }) => (
  <span
    aria-hidden="true"
    className={cn('grid size-8 shrink-0 place-items-center rounded-full bg-primary text-caption font-semibold text-primary-foreground', className)}
  >
    {getInitials(username)}
  </span>
)

const ITEM = 'flex min-h-11 items-center gap-2.5 text-body cursor-pointer text-foreground lg:min-h-9'

export const UserProfileDropdown: React.FC<UserProfileDropdownProps> = ({
  username,
  onTabChange,
  hideSensitive,
  sensitivePreferenceStatus,
  onToggleHideSensitive,
  darkMode,
  onToggleDarkMode,
  onLogout,
  trigger = 'avatar',
  align = 'end',
  side = 'bottom',
}) => {
  return (
    <div className={cn('shrink-0', trigger === 'row' && 'w-full')}>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          title="Account menu"
          className={cn(
            'flex cursor-pointer items-center transition duration-150 active:scale-[0.97]',
            trigger === 'avatar'
              ? 'size-11 justify-center rounded-full hover:bg-surface-2 lg:size-9'
              : 'min-h-11 w-full justify-center gap-2.5 rounded-xl px-2 hover:bg-surface-2 lg:justify-start',
          )}
        >
          <Avatar username={username} className={trigger === 'avatar' ? 'size-8' : 'size-8'} />
          {trigger === 'row' && (
            <>
              <span className="hidden min-w-0 flex-1 truncate text-left text-body font-medium text-foreground lg:block">{username || 'Account'}</span>
              <ChevronsUpDown className="hidden size-4 shrink-0 text-muted-foreground lg:block" aria-hidden="true" />
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} side={side} sideOffset={8} className="z-[60] min-w-56">
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <Avatar username={username} />
            <div className="min-w-0">
              <p className="truncate text-body font-semibold text-foreground">{username || 'User'}</p>
              <p className="text-caption text-muted-foreground">Signed in</p>
            </div>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => onTabChange('settings')} className={ITEM}>
            <Settings className="size-4 text-muted-foreground" />
            <span>Settings</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={sensitivePreferenceStatus === 'resolved' ? onToggleHideSensitive : undefined}
            disabled={sensitivePreferenceStatus !== 'resolved'}
            className={cn(ITEM, 'disabled:cursor-not-allowed')}
          >
            {sensitivePreferenceStatus === 'pending'
              ? <Loader2 className="size-4 animate-spin text-muted-foreground" />
              : hideSensitive
                ? <Eye className="size-4 text-muted-foreground" />
                : <EyeOff className="size-4 text-muted-foreground" />}
            <span>
              {sensitivePreferenceStatus === 'pending'
                ? 'Checking Privacy Settings'
                : sensitivePreferenceStatus === 'unavailable'
                  ? 'Privacy Setting Unavailable'
                  : hideSensitive ? 'Show Sensitive' : 'Hide Sensitive'}
            </span>
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={onToggleDarkMode} className={ITEM}>
            {darkMode ? <Sun className="size-4 text-muted-foreground" /> : <Moon className="size-4 text-muted-foreground" />}
            <span>{darkMode ? 'Light Theme' : 'Dark Theme'}</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={onLogout} className={cn(ITEM, 'text-destructive focus:text-destructive')}>
            <LogOut className="size-4" /> Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
