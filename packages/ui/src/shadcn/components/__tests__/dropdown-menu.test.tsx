import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../dropdown-menu'

describe('DropdownMenuContent', () => {
  it('composes the popup and scroll area without nesting scroll containers', () => {
    render(
      <DropdownMenu open>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Menu item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )

    const menu = screen.getByRole('menu')
    const viewport = menu.querySelector('[data-slot="scroll-area-viewport"]')
    expect(menu).toHaveAttribute('data-slot', 'dropdown-menu-content')
    expect(viewport).toHaveStyle({ overflow: 'hidden scroll' })
    expect(viewport).toContainElement(screen.getByRole('menuitem', { name: 'Menu item' }))
  })
})
