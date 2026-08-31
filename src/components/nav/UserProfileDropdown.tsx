import React from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
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

export interface UserProfileDropdownProps {
  username: string
  onTabChange: (tab: AppTab) => void
  hideSensitive: boolean
  sensitivePreferenceStatus: SensitivePreferenceStatus
  onToggleHideSensitive: () => void
  darkMode: boolean
  onToggleDarkMode: () => void
  onLogout: () => void
}

const getInitials = (name: string) => {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase()
}

export const UserProfileDropdown: React.FC<UserProfileDropdownProps> = ({
  username,
  onTabChange,
  hideSensitive,
  sensitivePreferenceStatus,
  onToggleHideSensitive,
  darkMode,
  onToggleDarkMode,
  onLogout,
}) => {
  return (
    <div className="shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Account menu"
          title="Account menu"
          className="flex size-11 items-center justify-center rounded-xl border border-border/60 bg-background p-0 cursor-pointer hover:bg-muted/50 active:scale-95 sm:size-9 transition duration-150"
        >
          <div className="flex size-7 items-center justify-center rounded-full border border-blue-500/20 bg-linear-to-tr from-blue-500 to-sky-400 text-xs font-extrabold text-on-vivid">
            {getInitials(username)}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-50 min-w-[180px] bg-card border border-border p-1 rounded-xl shadow-md">
          <div className="px-2.5 py-2">
            <p className="text-xs font-bold text-foreground">{username || 'User'}</p>
          </div>

          <DropdownMenuSeparator className="my-1 border-t border-border/30" />

          <DropdownMenuItem
            onSelect={() => onTabChange('settings')}
            className="flex min-h-11 items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer text-foreground sm:min-h-0"
          >
            <Settings className="size-3.5 text-blue-500" />
            <span>Settings</span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={sensitivePreferenceStatus === 'resolved' ? onToggleHideSensitive : undefined}
            disabled={sensitivePreferenceStatus !== 'resolved'}
            className="flex min-h-11 items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer text-foreground disabled:cursor-not-allowed sm:min-h-0"
          >
            {sensitivePreferenceStatus === 'pending'
              ? <Loader2 className="size-3.5 animate-spin text-blue-500" />
              : hideSensitive
                ? <Eye className="size-3.5 text-blue-500" />
                : <EyeOff className="size-3.5 text-blue-500" />}
            <span>
              {sensitivePreferenceStatus === 'pending'
                ? 'Checking Privacy Settings'
                : sensitivePreferenceStatus === 'unavailable'
                  ? 'Privacy Setting Unavailable'
                  : hideSensitive ? 'Show Sensitive' : 'Hide Sensitive'}
            </span>
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={onToggleDarkMode}
            className="flex min-h-11 items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted outline-hidden cursor-pointer text-foreground sm:min-h-0"
          >
            {darkMode ? <Sun className="size-3.5 text-blue-500" /> : <Moon className="size-3.5 text-blue-500" />}
            <span>{darkMode ? 'Light Theme' : 'Dark Theme'}</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 border-t border-border/30" />
            
          <DropdownMenuItem
            onSelect={onLogout}
            className="flex min-h-11 items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-orange-500 hover:bg-orange-500/10 outline-hidden cursor-pointer sm:min-h-0"
          >
            <LogOut className="size-3.5" /> Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
