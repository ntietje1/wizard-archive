import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { RIGHT_SIDEBAR_CONTENT } from '~/features/editor/chrome/right-sidebar-content'
import type { RightSidebarContentId } from '~/features/editor/chrome/right-sidebar-content'
import { RightSidebarContainer } from '../right-sidebar-container'
import { createFile, createNote } from '~/test/factories/sidebar-item-factory'
import type { RightSidebarPanelServices } from '../right-sidebar-panel-source'

const sidebarState = vi.hoisted(() => ({
  visible: true,
  activeContentId: 'history' as RightSidebarContentId,
  size: 300,
  isLoaded: true,
  setSize: vi.fn(),
  setVisible: vi.fn(),
  setActiveContent: vi.fn(),
  open: vi.fn(),
  close: vi.fn(),
  toggle: vi.fn(),
}))

const panelServices: RightSidebarPanelServices = {
  [RIGHT_SIDEBAR_CONTENT.history]: () => <div />,
  [RIGHT_SIDEBAR_CONTENT.backlinks]: () => <div />,
  [RIGHT_SIDEBAR_CONTENT.outgoing]: () => <div />,
  [RIGHT_SIDEBAR_CONTENT.outline]: () => <div />,
}

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
    sidebarState.visible = true
    sidebarState.activeContentId = RIGHT_SIDEBAR_CONTENT.history

    render(
      <RightSidebarContainer item={file} panelServices={panelServices} sidebar={sidebarState} />,
    )

    const sidebar = screen.getByTestId('right-sidebar')
    expect(sidebar).toHaveAttribute('data-item-id', file._id)
    expect(sidebar).toHaveAttribute('data-content-id', RIGHT_SIDEBAR_CONTENT.history)
    expect(sidebar).toHaveAttribute('data-item-type', file.type)
  })

  it('places the collapsed outline button under the toolbar area', () => {
    const note = createNote()
    sidebarState.visible = false

    render(
      <RightSidebarContainer item={note} panelServices={panelServices} sidebar={sidebarState} />,
    )

    expect(screen.getByTestId('outline-toggle-container')).toHaveClass(
      'absolute',
      'top-12',
      'right-2',
    )
  })

  it('does not own sidebar close policy when the item changes', () => {
    const firstNote = createNote()
    const secondNote = createNote()
    sidebarState.visible = true

    const { rerender } = render(
      <RightSidebarContainer
        item={firstNote}
        panelServices={panelServices}
        sidebar={sidebarState}
      />,
    )
    rerender(
      <RightSidebarContainer
        item={secondNote}
        panelServices={panelServices}
        sidebar={sidebarState}
      />,
    )

    expect(sidebarState.close).not.toHaveBeenCalled()
  })
})
