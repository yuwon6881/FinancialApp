import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  CalendarCheck2,
  BarChart3,
  Wallet,
  CreditCard,
  FileText,
  TrendingUp,
  Settings,
  Sparkles,
  Search,
  X,
  Moon,
  Sun,
  Eye,
  EyeOff,
  Plus,
  ArrowRight,
  Command,
} from 'lucide-react'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { RewardIcon, CommitmentIcon } from './semanticIcons'
import type { AppTab } from '../types'

export interface CommandPaletteItem {
  id: string
  title: string
  subtitle?: string
  category: 'Navigation' | 'Actions' | 'Preferences'
  keywords?: string[]
  icon: React.ComponentType<{ className?: string }>
  iconColor?: string
  perform: () => void
  disabled?: boolean
}

export interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onNavigate: (tab: AppTab) => void
  onQuickAction?: (action: 'transaction' | 'subscription' | 'wishlist') => void
  onAskAi?: () => void
  darkMode: boolean
  onToggleDarkMode: () => void
  hideSensitive: boolean
  onToggleHideSensitive: () => void
  sensitivePreferenceStatus: 'pending' | 'resolved' | 'unavailable'
}

export function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onQuickAction,
  onAskAi,
  darkMode,
  onToggleDarkMode,
  hideSensitive,
  onToggleHideSensitive,
  sensitivePreferenceStatus,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Define commands
  const commands: CommandPaletteItem[] = useMemo(() => [
    // Navigation
    {
      id: 'nav-dashboard',
      title: 'Go to Today',
      subtitle: 'Cycle overview, safe-to-spend, and focus cards',
      category: 'Navigation',
      keywords: ['dashboard', 'home', 'overview', 'summary'],
      icon: CalendarCheck2,
      iconColor: 'text-blue-500',
      perform: () => { onNavigate('dashboard'); onClose() },
    },
    {
      id: 'nav-ledger',
      title: 'Go to Ledger',
      subtitle: 'View, filter, and manage transactions',
      category: 'Navigation',
      keywords: ['transactions', 'expenses', 'income', 'history'],
      icon: Wallet,
      iconColor: 'text-teal-500',
      perform: () => { onNavigate('ledger'); onClose() },
    },
    {
      id: 'nav-recurring',
      title: 'Go to Recurring Bills & Loans',
      subtitle: 'Upcoming bills, subscriptions, and amortizations',
      category: 'Navigation',
      keywords: ['bills', 'subscriptions', 'loans', 'timeline', 'recurring'],
      icon: CreditCard,
      iconColor: 'text-violet-500',
      perform: () => { onNavigate('recurring'); onClose() },
    },
    {
      id: 'nav-reports',
      title: 'Go to Reports',
      subtitle: 'Category limit performance and cycle analytics',
      category: 'Navigation',
      keywords: ['reports', 'analytics', 'charts', 'trends', 'limits'],
      icon: BarChart3,
      iconColor: 'text-indigo-500',
      perform: () => { onNavigate('reports'); onClose() },
    },
    {
      id: 'nav-commitments',
      title: 'Go to Commitments & Rewards',
      subtitle: 'Savings goals, funding buckets, and wishlists',
      category: 'Navigation',
      keywords: ['wishlist', 'goals', 'savings', 'rewards', 'commitments'],
      icon: CommitmentIcon,
      iconColor: 'text-pink-500',
      perform: () => { onNavigate('wishlist'); onClose() },
    },
    {
      id: 'nav-investments',
      title: 'Go to Investments',
      subtitle: 'Portfolio holdings, asset allocation, and drift',
      category: 'Navigation',
      keywords: ['investments', 'portfolio', 'stocks', 'etf', 'allocation'],
      icon: TrendingUp,
      iconColor: 'text-violet-500',
      perform: () => { onNavigate('investments'); onClose() },
    },
    {
      id: 'nav-documents',
      title: 'Go to Vault',
      subtitle: 'Receipt documents and retention policy',
      category: 'Navigation',
      keywords: ['vault', 'documents', 'receipts', 'files', 'pdf'],
      icon: FileText,
      iconColor: 'text-amber-500',
      perform: () => { onNavigate('documents'); onClose() },
    },
    {
      id: 'nav-settings',
      title: 'Go to Settings',
      subtitle: 'Preferences, security, accounts, and backups',
      category: 'Navigation',
      keywords: ['settings', 'preferences', 'security', 'password', 'accounts'],
      icon: Settings,
      iconColor: 'text-blue-500',
      perform: () => { onNavigate('settings'); onClose() },
    },

    // Quick Actions
    {
      id: 'action-post-tx',
      title: 'Post Transaction',
      subtitle: 'Record a new debit, credit, or bucket move',
      category: 'Actions',
      keywords: ['add', 'new', 'transaction', 'spend', 'income', 'expense'],
      icon: Plus,
      iconColor: 'text-emerald-500',
      perform: () => { onQuickAction?.('transaction'); onClose() },
    },
    {
      id: 'action-new-sub',
      title: 'New Subscription',
      subtitle: 'Track a recurring bill or scheduled payment',
      category: 'Actions',
      keywords: ['add', 'new', 'subscription', 'bill', 'recurring'],
      icon: CreditCard,
      iconColor: 'text-violet-500',
      perform: () => { onQuickAction?.('subscription'); onClose() },
    },
    {
      id: 'action-add-reward',
      title: 'Add Reward / Wishlist Item',
      subtitle: 'Save for a new target or wishlist reward',
      category: 'Actions',
      keywords: ['wishlist', 'reward', 'add', 'goal'],
      icon: RewardIcon,
      iconColor: 'text-pink-500',
      perform: () => { onQuickAction?.('wishlist'); onClose() },
    },
    {
      id: 'action-ask-ai',
      title: 'Ask AI Financial Assistant',
      subtitle: 'Query budget insights, spending pace, or plans',
      category: 'Actions',
      keywords: ['ai', 'ask', 'assistant', 'explain', 'chat'],
      icon: Sparkles,
      iconColor: 'text-blue-500',
      perform: () => { onAskAi?.(); onClose() },
    },

    // Preferences
    {
      id: 'pref-theme',
      title: darkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme',
      subtitle: 'Toggle application theme appearance',
      category: 'Preferences',
      keywords: ['theme', 'dark', 'light', 'mode', 'color'],
      icon: darkMode ? Sun : Moon,
      iconColor: 'text-amber-500',
      perform: () => { onToggleDarkMode(); onClose() },
    },
    {
      id: 'pref-sensitive',
      title: hideSensitive ? 'Reveal Sensitive Amounts' : 'Hide Sensitive Amounts',
      subtitle: 'Toggle financial amounts privacy masking',
      category: 'Preferences',
      keywords: ['sensitive', 'privacy', 'hide', 'mask', 'show'],
      icon: hideSensitive ? Eye : EyeOff,
      iconColor: 'text-blue-500',
      disabled: sensitivePreferenceStatus !== 'resolved',
      perform: () => { onToggleHideSensitive(); onClose() },
    },
  ], [
    darkMode,
    hideSensitive,
    onAskAi,
    onClose,
    onNavigate,
    onQuickAction,
    onToggleDarkMode,
    onToggleHideSensitive,
    sensitivePreferenceStatus,
  ])

  // Filter commands
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(item => {
      if (item.title.toLowerCase().includes(q)) return true
      if (item.subtitle?.toLowerCase().includes(q)) return true
      if (item.category.toLowerCase().includes(q)) return true
      if (item.keywords?.some(k => k.toLowerCase().includes(q))) return true
      return false
    })
  }, [commands, query])

  // Reset state on open/close
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      window.requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [isOpen])

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(Math.max(0, filteredCommands.length - 1))
    }
  }, [filteredCommands.length, selectedIndex])

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return
    const activeElement = listRef.current.querySelector<HTMLElement>('[data-active="true"]')
    if (activeElement && typeof activeElement.scrollIntoView === 'function') {
      activeElement.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredCommands.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = filteredCommands[selectedIndex]
      if (item && !item.disabled) {
        item.perform()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-12 sm:pt-20 bg-background/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-border/70 bg-card shadow-2xl overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[70vh] animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Header */}
        <div className="relative flex items-center border-b border-border/50 px-4 py-3 bg-muted/20">
          <Search className="size-4.5 text-muted-foreground shrink-0 mr-3" />
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Type a command, page, or action…"
            className="w-full bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground outline-hidden border-0 shadow-none focus-visible:ring-0"
            aria-autocomplete="list"
            aria-controls="command-palette-list"
          />
          {query ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </Button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
              <Command className="size-2.5" /> K
            </kbd>
          )}
        </div>

        {/* Command List */}
        <div
          ref={listRef}
          id="command-palette-list"
          role="listbox"
          className="flex-1 overflow-y-auto p-2 space-y-1 overscroll-contain"
        >
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No matching commands or pages found.
            </div>
          ) : (
            filteredCommands.map((item, index) => {
              const isSelected = index === selectedIndex
              const Icon = item.icon
              return (
                <Button
                  key={item.id}
                  variant="unstyled"
                  role="option"
                  aria-selected={isSelected}
                  data-active={isSelected}
                  disabled={item.disabled}
                  onClick={() => {
                    if (!item.disabled) item.perform()
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer transition-all duration-100 ${
                    isSelected
                      ? 'bg-muted/80 text-foreground border border-border/60 shadow-xs'
                      : 'text-foreground hover:bg-muted/40 border border-transparent'
                  } ${item.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 border border-border/40 bg-card ${item.iconColor || 'text-foreground'}`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-[11px] text-muted-foreground truncate">{item.subtitle}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline-block text-[10px] font-semibold text-muted-foreground px-2 py-0.5 rounded-md bg-muted/40 border border-border/30">
                      {item.category}
                    </span>
                    <ArrowRight className={`size-3.5 text-muted-foreground transition-transform ${isSelected ? 'translate-x-0.5 opacity-100' : 'opacity-0'}`} />
                  </div>
                </Button>
              )
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/40 bg-muted/15 text-[10px] text-muted-foreground select-none">
          <div className="flex items-center gap-3">
            <span><kbd className="font-bold">↑↓</kbd> Navigate</span>
            <span><kbd className="font-bold">↵</kbd> Select</span>
            <span><kbd className="font-bold">esc</kbd> Dismiss</span>
          </div>
          <span className="font-semibold text-foreground/75">Quick Launcher</span>
        </div>
      </div>
    </div>
  )
}
