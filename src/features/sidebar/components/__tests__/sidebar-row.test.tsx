import { render, screen } from '@testing-library/react'
import { Plus } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { SidebarRow } from '../sidebar-row'

describe('SidebarRow', () => {
  it('mutes inactive labels and icons until hover', () => {
    const { container } = render(<SidebarRow icon={Plus} label="New" />)
    const icon = container.querySelector('[data-sidebar-row-icon]')

    expect(screen.getByText('New')).toHaveClass('text-foreground/70')
    expect(screen.getByText('New')).toHaveClass('group-hover:text-foreground/90')
    expect(icon).not.toBeNull()
    expect(icon).toHaveClass('text-foreground/70')
    expect(icon).toHaveClass('group-hover:text-foreground/90')
  })

  it('keeps active labels and icons foreground without hover variants', () => {
    const { container } = render(<SidebarRow icon={Plus} label="Trash" isActive />)
    const icon = container.querySelector('[data-sidebar-row-icon]')

    expect(container.firstElementChild).toHaveAttribute('data-active', 'true')
    expect(screen.getByText('Trash')).toHaveClass('text-foreground')
    expect(screen.getByText('Trash')).not.toHaveClass('group-hover:text-foreground/90')
    expect(icon).not.toBeNull()
    expect(icon).toHaveClass('text-foreground')
    expect(icon).not.toHaveClass('group-hover:text-foreground/90')
  })
})
