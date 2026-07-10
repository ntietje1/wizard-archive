import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, useRef } from 'react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContextMenuHost } from '../host'
import type { ContextMenuHostRef } from '../host'
import type { BuiltContextMenu } from '../../types'

const leafItem = {
  id: 'item-1',
  label: 'Paste',
  disabled: false,
  checked: false,
  group: 'group-1',
  priority: 0,
  onSelect: vi.fn(),
}

const submenuItem = {
  id: 'submenu-item-1',
  label: 'Send to back',
  disabled: false,
  checked: false,
  group: 'group-1',
  priority: 0,
  onSelect: vi.fn(),
}

const secondSubmenuItem = {
  ...submenuItem,
  id: 'submenu-item-2',
  label: 'Distribute H',
  group: 'group-2',
}

const thirdSubmenuItem = {
  ...submenuItem,
  id: 'submenu-item-3',
  label: 'Flip H',
  group: 'group-3',
}

const alignSubmenuItem = {
  ...submenuItem,
  id: 'submenu-item-align',
  label: 'Center',
}

const submenuParent = {
  id: 'submenu-parent',
  label: 'Reorder',
  disabled: false,
  checked: false,
  group: 'group-1',
  priority: 0,
  onSelect: vi.fn(),
  children: [submenuItem],
}

const secondSubmenuParent = {
  ...submenuParent,
  id: 'submenu-parent-align',
  label: 'Align',
  children: [alignSubmenuItem],
}

const groupedSubmenuParent = {
  ...submenuParent,
  children: [submenuItem, secondSubmenuItem, thirdSubmenuItem],
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

const outerItem = {
  ...leafItem,
  id: 'outer-item',
  label: 'Outer action',
}

const innerItem = {
  ...leafItem,
  id: 'inner-item',
  label: 'Inner action',
}

const outerMenu: BuiltContextMenu = {
  groups: [
    {
      id: 'outer-group',
      items: [outerItem],
    },
  ],
  flatItems: [outerItem],
  isEmpty: false,
}

const innerMenu: BuiltContextMenu = {
  groups: [
    {
      id: 'inner-group',
      items: [innerItem],
    },
  ],
  flatItems: [innerItem],
  isEmpty: false,
}

const persistentItem = {
  id: 'item-persistent',
  label: 'Reading Mode',
  disabled: false,
  checked: false,
  group: 'group-1',
  priority: 0,
  closeOnSelect: false,
  onSelect: vi.fn(),
}

const persistentMenu: BuiltContextMenu = {
  groups: [
    {
      id: 'group-1',
      items: [persistentItem],
    },
  ],
  flatItems: [persistentItem],
  isEmpty: false,
}

const richContentItem = {
  id: 'item-rich',
  label: 'Mina',
  disabled: false,
  checked: false,
  group: 'group-1',
  priority: 0,
  content: (
    <span>
      <span>Mina</span>
      <span>@mina</span>
    </span>
  ),
  onSelect: vi.fn(),
}

const richContentMenu: BuiltContextMenu = {
  groups: [
    {
      id: 'group-1',
      items: [richContentItem],
    },
  ],
  flatItems: [richContentItem],
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

const siblingSubmenuMenu: BuiltContextMenu = {
  groups: [
    {
      id: 'group-1',
      items: [submenuParent, secondSubmenuParent],
    },
  ],
  flatItems: [submenuParent, submenuItem, secondSubmenuParent, alignSubmenuItem],
  isEmpty: false,
}

const groupedSubmenuMenu: BuiltContextMenu = {
  groups: [
    {
      id: 'group-1',
      items: [groupedSubmenuParent],
    },
  ],
  flatItems: [groupedSubmenuParent, submenuItem, secondSubmenuItem, thirdSubmenuItem],
  isEmpty: false,
}

const customSubmenuMenu: BuiltContextMenu = {
  groups: [
    {
      id: 'group-1',
      items: [
        {
          id: 'share-submenu',
          label: 'Share...',
          disabled: false,
          checked: false,
          group: 'group-1',
          priority: 0,
          onSelect: vi.fn(),
          submenuContent: <div data-testid="share-panel">Share panel</div>,
        },
      ],
    },
  ],
  flatItems: [],
  isEmpty: false,
}

const customContentSubmenuMenu: BuiltContextMenu = {
  groups: [
    {
      id: 'group-1',
      items: [
        {
          id: 'share-submenu',
          label: 'Share...',
          disabled: false,
          checked: false,
          group: 'group-1',
          priority: 0,
          content: <span aria-hidden="true">Icon only</span>,
          onSelect: vi.fn(),
          submenuContent: <div data-testid="share-panel">Share panel</div>,
        },
      ],
    },
  ],
  flatItems: [],
  isEmpty: false,
}

const siblingCustomSubmenuMenu: BuiltContextMenu = {
  groups: [
    {
      id: 'group-1',
      items: [
        {
          id: 'share-submenu',
          label: 'Share...',
          disabled: false,
          checked: false,
          group: 'group-1',
          priority: 0,
          onSelect: vi.fn(),
          submenuContent: <div data-testid="share-panel">Share panel</div>,
        },
        {
          id: 'view-as-submenu',
          label: 'View as Player...',
          disabled: false,
          checked: false,
          group: 'group-1',
          priority: 1,
          onSelect: vi.fn(),
          submenuContent: <div data-testid="view-as-panel">View as panel</div>,
        },
      ],
    },
  ],
  flatItems: [],
  isEmpty: false,
}

function TestContextMenuHost(props: Omit<ComponentProps<typeof ContextMenuHost>, 'ref'>) {
  const ref = useRef<ContextMenuHostRef>(null)
  return <ContextMenuHost ref={ref} {...props} />
}

describe('ContextMenuHost', () => {
  afterEach(() => {
    vi.clearAllMocks()
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

  it('opens a pending imperative menu when its model becomes non-empty', async () => {
    const ref = createRef<ContextMenuHostRef>()
    const emptyMenu: BuiltContextMenu = {
      groups: [],
      flatItems: [],
      isEmpty: true,
    }

    const { rerender } = render(<ContextMenuHost ref={ref} menu={emptyMenu} />)

    act(() => {
      ref.current?.open({ x: 120, y: 240 })
    })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    rerender(<ContextMenuHost ref={ref} menu={simpleMenu} />)

    await expect(screen.findByRole('menu')).resolves.toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Paste' })).toBeVisible()
  })

  it('replaces the open menu after a right-button outside press and the next contextmenu event', async () => {
    const user = userEvent.setup()

    render(
      <TestContextMenuHost menu={simpleMenu}>
        <div data-testid="context-trigger">Canvas surface</div>
      </TestContextMenuHost>,
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
      <TestContextMenuHost menu={simpleMenu}>
        <div data-testid="context-trigger">Canvas surface</div>
      </TestContextMenuHost>,
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
      <TestContextMenuHost menu={simpleMenu}>
        <div data-testid="context-trigger">Canvas surface</div>
      </TestContextMenuHost>,
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

  it('runs the menu item action without clicking the trigger underneath', async () => {
    const user = userEvent.setup()
    const triggerClick = vi.fn()

    render(
      <TestContextMenuHost menu={simpleMenu}>
        <button type="button" data-testid="context-trigger" onClick={triggerClick}>
          Sidebar item
        </button>
      </TestContextMenuHost>,
    )

    fireEvent.contextMenu(screen.getByTestId('context-trigger'), {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 32,
      button: 2,
    })

    await user.click(await screen.findByRole('menuitem', { name: 'Paste' }))

    expect(leafItem.onSelect).toHaveBeenCalledTimes(1)
    expect(triggerClick).not.toHaveBeenCalled()
  })

  it('opens the innermost menu when context menu hosts are nested', async () => {
    render(
      <TestContextMenuHost menu={outerMenu}>
        <div>
          <TestContextMenuHost menu={innerMenu}>
            <button type="button" data-testid="nested-context-trigger">
              Sidebar item
            </button>
          </TestContextMenuHost>
        </div>
      </TestContextMenuHost>,
    )

    fireEvent.contextMenu(screen.getByTestId('nested-context-trigger'), {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 32,
      button: 2,
    })

    await expect(screen.findByRole('menuitem', { name: 'Inner action' })).resolves.toBeVisible()
    expect(screen.queryByRole('menuitem', { name: 'Outer action' })).not.toBeInTheDocument()
  })

  it('keeps the menu open after actions that opt out of closing', async () => {
    const user = userEvent.setup()

    render(
      <TestContextMenuHost menu={persistentMenu}>
        <div data-testid="context-trigger">Topbar</div>
      </TestContextMenuHost>,
    )

    fireEvent.contextMenu(screen.getByTestId('context-trigger'), {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 32,
      button: 2,
    })

    await user.click(await screen.findByRole('menuitem', { name: 'Reading Mode' }))

    expect(persistentItem.onSelect).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('menu')).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Reading Mode' })).toBeVisible()
  })

  it('renders custom item content while preserving the menu item label', async () => {
    render(
      <TestContextMenuHost menu={richContentMenu}>
        <div data-testid="context-trigger">Topbar</div>
      </TestContextMenuHost>,
    )

    fireEvent.contextMenu(screen.getByTestId('context-trigger'), {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 32,
      button: 2,
    })

    expect(await screen.findByRole('menuitem', { name: 'Mina' })).toBeVisible()
    expect(screen.getByText('@mina')).toBeVisible()
  })

  it('opens hover submenus without collapsing the root menu', async () => {
    const user = userEvent.setup()

    render(
      <TestContextMenuHost menu={submenuMenu}>
        <div data-testid="context-trigger">Canvas surface</div>
      </TestContextMenuHost>,
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
    expect(reorderItem.querySelector('svg')).not.toBeInTheDocument()
    expect(sendToBackItem).toBeVisible()
  })

  it('renders separators between submenu child groups', async () => {
    const user = userEvent.setup()
    render(
      <TestContextMenuHost menu={groupedSubmenuMenu}>
        <div data-testid="context-trigger">Canvas surface</div>
      </TestContextMenuHost>,
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

    await screen.findByRole('menuitem', { name: 'Flip H' })
    expect(document.body.querySelectorAll('[data-slot="context-menu-separator"]')).toHaveLength(2)
  })

  it('keeps normal sibling submenus mutually exclusive', async () => {
    const user = userEvent.setup()
    render(
      <TestContextMenuHost menu={siblingSubmenuMenu}>
        <div data-testid="context-trigger">Canvas surface</div>
      </TestContextMenuHost>,
    )

    fireEvent.contextMenu(screen.getByTestId('context-trigger'), {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 32,
      button: 2,
    })

    await user.hover(await screen.findByRole('menuitem', { name: 'Reorder' }))
    expect(await screen.findByRole('menuitem', { name: 'Send to back' })).toBeVisible()

    await user.hover(await screen.findByRole('menuitem', { name: 'Align' }))

    expect(await screen.findByRole('menuitem', { name: 'Center' })).toBeVisible()
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Send to back' })).not.toBeInTheDocument()
    })
  })

  it('keeps rich sibling submenus mutually exclusive', async () => {
    const user = userEvent.setup()
    render(
      <TestContextMenuHost menu={siblingCustomSubmenuMenu}>
        <div data-testid="context-trigger">Canvas surface</div>
      </TestContextMenuHost>,
    )

    fireEvent.contextMenu(screen.getByTestId('context-trigger'), {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 32,
      button: 2,
    })

    await user.hover(await screen.findByRole('menuitem', { name: 'Share...' }))
    expect(await screen.findByTestId('share-panel')).toBeVisible()

    await user.hover(await screen.findByRole('menuitem', { name: 'View as Player...' }))

    expect(await screen.findByTestId('view-as-panel')).toBeVisible()
    await waitFor(() => {
      expect(screen.queryByTestId('share-panel')).not.toBeInTheDocument()
    })
  })

  it('renders custom submenu content without running the parent action', async () => {
    const user = userEvent.setup()
    const shareItem = customSubmenuMenu.groups[0]!.items[0]!

    render(
      <TestContextMenuHost menu={customSubmenuMenu}>
        <div data-testid="context-trigger">Canvas surface</div>
      </TestContextMenuHost>,
    )

    fireEvent.contextMenu(screen.getByTestId('context-trigger'), {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 32,
      button: 2,
    })

    const shareTrigger = await screen.findByRole('menuitem', { name: 'Share...' })
    await user.hover(shareTrigger)

    expect(await screen.findByTestId('share-panel')).toBeVisible()
    expect(shareTrigger.querySelector('svg')).not.toBeInTheDocument()
    expect(shareItem.onSelect).not.toHaveBeenCalled()
  })

  it('labels custom-content submenu triggers with the menu item label', async () => {
    const user = userEvent.setup()

    render(
      <TestContextMenuHost menu={customContentSubmenuMenu}>
        <div data-testid="context-trigger">Canvas surface</div>
      </TestContextMenuHost>,
    )

    fireEvent.contextMenu(screen.getByTestId('context-trigger'), {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 32,
      button: 2,
    })

    await user.hover(await screen.findByRole('menuitem', { name: 'Share...' }))

    expect(await screen.findByTestId('share-panel')).toBeVisible()
  })

  it('positions custom submenu content next to the menu item instead of fixed to the viewport', async () => {
    const user = userEvent.setup()

    render(
      <TestContextMenuHost menu={customSubmenuMenu}>
        <div data-testid="context-trigger">Canvas surface</div>
      </TestContextMenuHost>,
    )

    fireEvent.contextMenu(screen.getByTestId('context-trigger'), {
      bubbles: true,
      cancelable: true,
      clientX: 24,
      clientY: 32,
      button: 2,
    })

    await user.hover(await screen.findByRole('menuitem', { name: 'Share...' }))

    const sharePanel = await screen.findByTestId('share-panel')
    const submenuContent = sharePanel.closest('[data-slot="context-menu-rich-submenu-content"]')
    expect(submenuContent).toHaveAttribute('data-side', 'right')
  })

  it('opens custom submenu content to the left when the right side does not have room', async () => {
    const user = userEvent.setup()
    const originalInnerWidthDescriptor = Object.getOwnPropertyDescriptor(window, 'innerWidth')
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this.getAttribute('data-slot') === 'context-menu-sub-trigger') {
          return DOMRect.fromRect({ x: 880, y: 40, width: 120, height: 28 })
        }
        if (this.getAttribute('data-slot') === 'context-menu-rich-submenu-content') {
          return DOMRect.fromRect({ x: 1000, y: 40, width: 300, height: 160 })
        }
        return DOMRect.fromRect()
      },
    )

    try {
      render(
        <TestContextMenuHost menu={customSubmenuMenu}>
          <div data-testid="context-trigger">Canvas surface</div>
        </TestContextMenuHost>,
      )

      fireEvent.contextMenu(screen.getByTestId('context-trigger'), {
        bubbles: true,
        cancelable: true,
        clientX: 24,
        clientY: 32,
        button: 2,
      })

      await user.hover(await screen.findByRole('menuitem', { name: 'Share...' }))

      const sharePanel = await screen.findByTestId('share-panel')
      const submenuContent = sharePanel.closest('[data-slot="context-menu-rich-submenu-content"]')
      await waitFor(() => {
        expect(submenuContent).toHaveAttribute('data-side', 'left')
      })
    } finally {
      if (originalInnerWidthDescriptor) {
        Object.defineProperty(window, 'innerWidth', originalInnerWidthDescriptor)
      }
    }
  })

  it('keeps custom submenu content open while focus moves into a marked portal', async () => {
    const user = userEvent.setup()
    const portal = document.createElement('div')
    portal.setAttribute('data-context-menu-rich-submenu-portal', '')
    const portalButton = document.createElement('button')
    portalButton.textContent = 'Portal action'
    portal.append(portalButton)
    document.body.append(portal)

    try {
      render(
        <TestContextMenuHost menu={customSubmenuMenu}>
          <div data-testid="context-trigger">Canvas surface</div>
        </TestContextMenuHost>,
      )

      fireEvent.contextMenu(screen.getByTestId('context-trigger'), {
        bubbles: true,
        cancelable: true,
        clientX: 24,
        clientY: 32,
        button: 2,
      })

      await user.hover(await screen.findByRole('menuitem', { name: 'Share...' }))
      const sharePanel = await screen.findByTestId('share-panel')
      const submenuContent = sharePanel.closest('[data-slot="context-menu-rich-submenu-content"]')

      fireEvent.pointerLeave(submenuContent!, { relatedTarget: portalButton })
      fireEvent.blur(submenuContent!, { relatedTarget: portalButton })

      expect(screen.getByTestId('share-panel')).toBeVisible()
    } finally {
      portal.remove()
    }
  })

  it('keeps custom submenu content open while focus moves into a legacy select portal', async () => {
    const user = userEvent.setup()
    const portal = document.createElement('div')
    portal.setAttribute('data-slot', 'select-content')
    const portalOption = document.createElement('button')
    portalOption.textContent = 'Edit'
    portal.append(portalOption)
    document.body.append(portal)

    try {
      render(
        <TestContextMenuHost menu={customSubmenuMenu}>
          <button type="button" data-testid="context-trigger">
            Sidebar item
          </button>
        </TestContextMenuHost>,
      )

      fireEvent.contextMenu(screen.getByTestId('context-trigger'), {
        bubbles: true,
        cancelable: true,
        clientX: 24,
        clientY: 32,
        button: 2,
      })

      await user.hover(await screen.findByRole('menuitem', { name: 'Share...' }))
      const sharePanel = await screen.findByTestId('share-panel')
      const submenuContent = sharePanel.closest('[data-slot="context-menu-rich-submenu-content"]')

      fireEvent.pointerLeave(submenuContent!, { relatedTarget: portalOption })
      fireEvent.blur(submenuContent!, { relatedTarget: portalOption })

      expect(screen.getByTestId('share-panel')).toBeVisible()
    } finally {
      portal.remove()
    }
  })
})
