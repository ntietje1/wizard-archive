import { createRef } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyContextMenu } from '../empty'
import { ContextMenuSurface } from '../surface'
import type { ContextMenuHostRef } from '../host'
import type { BuiltContextMenu } from '../../types'

const emptyMenu: BuiltContextMenu = {
  groups: [],
  flatItems: [],
  isEmpty: true,
}

describe('ContextMenuSurface', () => {
  it('keeps the surface wrapper when menu interactions are disabled', () => {
    render(
      <ContextMenuSurface
        disabled
        className="h-full"
        model={{ hostRef: createRef<ContextMenuHostRef>(), menu: emptyMenu }}
      >
        <button type="button">Open item</button>
      </ContextMenuSurface>,
    )

    expect(screen.getByRole('button', { name: 'Open item' }).closest('.h-full')).toBeVisible()
  })
})

describe('EmptyContextMenu', () => {
  it('uses the provided element as the suppressed context-menu trigger', () => {
    render(
      <ul data-testid="menu-list">
        <EmptyContextMenu>
          <li>Sort options</li>
        </EmptyContextMenu>
      </ul>,
    )

    const list = screen.getByTestId('menu-list')
    const item = screen.getByText('Sort options')

    expect(list.firstElementChild).toBe(item)
    expect(fireEvent.contextMenu(item, { bubbles: true, cancelable: true })).toBe(false)
  })
})
