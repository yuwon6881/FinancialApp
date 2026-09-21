import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MobileBottomNav, type NavItemConfig } from './MobileBottomNav'

const Icon = ({ className }: { className?: string }) => <svg className={className} aria-hidden="true" />

const navItems: NavItemConfig[] = [
  { tab: 'dashboard', label: 'Today', mobileLabel: 'Today', Icon, iconClass: 'text-primary' },
  { tab: 'documents', label: 'Vault', mobileLabel: 'Vault', Icon, iconClass: 'text-primary' },
]

describe('MobileBottomNav', () => {
  it('keeps inactive labels and icons at the full semantic muted-foreground color for contrast', () => {
    render(<MobileBottomNav navItems={navItems} activeTab="dashboard" onTabChange={vi.fn()} />)

    const vaultButton = screen.getByRole('button', { name: 'Vault' })
    const label = screen.getByText('Vault')
    const icon = vaultButton.querySelector('svg')

    expect(label.className).toContain('text-muted-foreground')
    expect(label.className).not.toMatch(/text-muted-foreground\/\d+/)
    expect(icon?.getAttribute('class')).toContain('text-muted-foreground')
    expect(icon?.getAttribute('class')).not.toMatch(/text-muted-foreground\/\d+/)
  })
})
