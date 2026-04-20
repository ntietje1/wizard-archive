import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContextMenuHost } from '../context-menu-host'
import type { ContextMenuHostRef } from '../context-menu-host'
import type { BuiltContextMenu } from '../../types'

const leafItem = {
  id: 'item-1',
  label: 'Paste',
  disabled: false,
  checked: false,
  group: 'group-1',
  priority: 0,
  scope: 'target' as const,
  onSelect: vi.fn(),
}

const submenuItem = {
  id: 'submenu-item-1',
  label: 'Send to back',
  disabled: false,
  checked: false,
  group: 'group-1',
  priority: 0,
  scope: 'target' as const,
  onSelect: vi.fn(),
}

const submenuParent = {
  id: 'submenu-parent',
  label: 'Reorder',
  disabled: false,
  checked: false,
  group: 'group-1',
  priority: 0,
  scope: 'target' as const,
  onSelect: vi.fn(),
  children: [submenuItem],
}

const simpleMenu: BuiltContextMenu = {
  groups: [
    {
      id: 'group-1',
      items: [leafItem],
    },
  ],
  flatItems: [leafItem],
  isEmpty: false,
}

const submenuMenu: BuiltContextMenu = {
  groups: [
    {
      id: 'group-1',
      items: [leafItem, submenuParent],
    },
  ],
  flatItems: [leafItem, submenuParent, submenuItem],
  isEmpty: false,
}

describe('ContextMenuHost', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens imperative menus through the shared non-modal root', async () => {
    const ref = createRef<ContextMenuHostRef>()

    render(<ContextMenuHost ref={ref} menu={simpleMenu} />)

    act(() => {
      ref.current?.open({ x: 120, y: 240 })
    })

    await expect(screen.findByRole('menu')).resolves.toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Paste' })).toBeVisible()
  })

  it('replaces the open menu after a right-button outside press and the next contextmenu event', async () => {
    const user = userEvent.setup()

    render(
      <ContextMenuHost menu={simpleMenu}>
        <div data-testid="context-trigger">Canvas surface</div>
      </ContextMenuHost>,
    )

    const trigger = screen.getByTestId('context-trigger')

    fireEvent.contextMenu(trigger, {
      bubbles: true,
      cancelable: true,
      clientX: 40,
      clientY: 60,
      button: 2,
    })
    await expect(screen.findByRole('menu')).resolves.toBeVisible()

    fireEvent.pointerDown(document.body, {
      bubbles: true,
      button: 2,
      clientX: 100,
      clientY: 120,
    })
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    await user.pointer([
      {
        target: trigger,
        keys: '[MouseRight]',
        coords: { x: 80, y: 80 },
      },
    ])

    await expect(screen.findByRole('menu')).resolves.toBeVisible()
  })

  it('closes immediately on outside left pointerdown', async () => {
    render(
      <ContextMenuHost menu={simpleMenu}>
        <div data-testid="context-trigger">Canvas surface</div>
      </ContextMenuHost>,
    )

    fireEvent.contextMenu(screen.getByTestId('context-trigger'), {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 32,
      button: 2,
    })

    await expect(screen.findByRole('menu')).resolves.toBeVisible()

    fireEvent.pointerDown(document.body, {
      bubbles: true,
      button: 0,
      clientX: 300,
      clientY: 320,
    })

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  it('does not close the root menu when leaving a normal item', async () => {
    const user = userEvent.setup()

    render(
      <ContextMenuHost menu={simpleMenu}>
        <div data-testid="context-trigger">Canvas surface</div>
      </ContextMenuHost>,
    )

    fireEvent.contextMenu(screen.getByTestId('context-trigger'), {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 32,
      button: 2,
    })

    const pasteItem = await screen.findByRole('menuitem', { name: 'Paste' })
    await user.hover(pasteItem)
    fireEvent.pointerLeave(pasteItem)

    expect(screen.getByRole('menu')).toBeVisible()
    expect(pasteItem).toBeVisible()
  })

  it('opens hover submenus without collapsing the root menu', async () => {
    const user = userEvent.setup()

    render(
      <ContextMenuHost menu={submenuMenu}>
        <div data-testid="context-trigger">Canvas surface</div>
      </ContextMenuHost>,
    )

    fireEvent.contextMenu(screen.getByTestId('context-trigger'), {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 32,
      button: 2,
    })

    const reorderItem = await screen.findByRole('menuitem', { name: 'Reorder' })
    await user.hover(reorderItem)

    const sendToBackItem = await screen.findByRole('menuitem', { name: 'Send to back' })
    expect(screen.getAllByRole('menu')).toHaveLength(2)
    expect(reorderItem).toBeVisible()
    expect(sendToBackItem).toBeVisible()
  })
})
