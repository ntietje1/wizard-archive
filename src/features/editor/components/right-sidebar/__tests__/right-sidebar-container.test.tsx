import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { ReactNode } from 'react'
import { RIGHT_SIDEBAR_CONTENT } from '../constants'
import { RightSidebarContainer } from '../right-sidebar-container'
import { createFile, createNote } from '~/test/factories/sidebar-item-factory'

const currentItemState = vi.hoisted(() => ({
  item: null as AnySidebarItem | null,
}))

const sidebarState = vi.hoisted(() => ({
  visible: true,
  activeContentId: 'history',
  size: 300,
  isLoaded: true,
  setSize: vi.fn(),
  setVisible: vi.fn(),
  setActiveContent: vi.fn(),
  open: vi.fn(),
  close: vi.fn(),
}))

vi.mock('~/features/sidebar/hooks/useCurrentItem', () => ({
  useCurrentItem: () => ({ item: currentItemState.item }),
}))

vi.mock('~/features/editor/hooks/useRightSidebar', () => ({
  useRightSidebar: () => sidebarState,
}))

vi.mock('~/features/sidebar/components/resizable-sidebar', () => ({
  ResizableSidebar: ({ children }: { children: ReactNode }) => (
    <div data-testid="resizable-sidebar">{children}</div>
  ),
}))

vi.mock('../right-sidebar', () => ({
  RightSidebar: ({
    itemId,
    activeContentId,
    itemType,
  }: {
    itemId: string
    activeContentId: string
    itemType: string
  }) => (
    <div
      data-testid="right-sidebar"
      data-item-id={itemId}
      data-content-id={activeContentId}
      data-item-type={itemType}
    />
  ),
}))

describe('RightSidebarContainer', () => {
  it('shows the history sidebar for file items', () => {
    const file = createFile()
    currentItemState.item = file
    sidebarState.visible = true
    sidebarState.activeContentId = RIGHT_SIDEBAR_CONTENT.outline

    render(<RightSidebarContainer />)

    const sidebar = screen.getByTestId('right-sidebar')
    expect(sidebar).toHaveAttribute('data-item-id', file._id)
    expect(sidebar).toHaveAttribute('data-content-id', RIGHT_SIDEBAR_CONTENT.history)
    expect(sidebar).toHaveAttribute('data-item-type', file.type)
  })

  it('places the collapsed outline button under the toolbar area', () => {
    currentItemState.item = createNote()
    sidebarState.visible = false

    render(<RightSidebarContainer />)

    expect(screen.getByTestId('outline-toggle-container')).toHaveClass(
      'absolute',
      'top-12',
      'right-2',
    )
  })
})
