import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import type { FolderItem } from '../../../workspace/items'
import { RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'
import type { ResourceItemCardProps } from '../../../filesystem/cards/shell'
import { FolderCard } from '../card'

const handleItemClickMock = vi.hoisted(() => vi.fn())

vi.mock('../../../workspace/context-menu/context-menu', () => ({
  WorkspaceContextMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

vi.mock('../../../context-menu/hooks/use-context-menu', () => ({
  useContextMenu: () => ({
    contextMenuRef: { current: null },
    handleMoreOptions: vi.fn(),
  }),
}))

vi.mock('../../../drag-drop/use-draggable', () => ({
  useDraggable: () => ({
    draggableRef: { current: null },
    isDraggingRef: { current: false },
  }),
}))

vi.mock('../../../drag-drop/use-sidebar-item-drop-target', () => ({
  useSidebarItemDropTarget: () => ({
    dropTargetRef: { current: null },
    isDropTarget: false,
    isFileDropTarget: false,
    isTrashAction: false,
  }),
}))

vi.mock('../../../drag-drop/ref-utils', () => ({
  useMergedRef: () => vi.fn(),
}))

vi.mock('../../../drag-drop/store', () => ({
  useDndStore: () => false,
}))

vi.mock('../../../drag-drop/sidebar-drag-data', () => ({
  useSidebarDragData: () => ({
    sidebarItemId: 'folder-1',
    sidebarItemIds: ['folder-1'],
    dragPreviewItemIds: ['folder-1'],
  }),
}))

vi.mock('../../../workspace/sidebar/use-item-selection-interactions', () => ({
  useItemSelectionInteractions: () => ({
    handleItemClick: handleItemClickMock,
    handleItemContextMenu: vi.fn(),
  }),
}))

vi.mock('../../../workspace/sidebar/use-sidebar-item-visual-state', () => ({
  useSidebarItemVisualState: () => ({}),
}))

describe('FolderCard', () => {
  it('lets selection-only modifier clicks skip custom activation', () => {
    const onClick = vi.fn()

    handleItemClickMock.mockImplementation((event) => {
      event.preventDefault()
    })

    render(<FolderCard item={createFolderItem()} onClick={onClick} source={createSource()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Session Prep' }), { shiftKey: true })

    expect(handleItemClickMock).toHaveBeenCalledOnce()
    expect(onClick).not.toHaveBeenCalled()
  })
})

function createFolderItem(): FolderItem {
  return {
    id: 'folder-1' as SidebarItemId,
    name: 'Session Prep',
    type: RESOURCE_TYPES.folders,
  } as unknown as FolderItem
}

function createSource(): ResourceItemCardProps<FolderItem>['source'] {
  return {
    canDragItem: () => false,
    currentItemId: null,
    getSidebarDragData: (item) => ({
      sidebarItemId: item.id,
      sidebarItemIds: [item.id],
      dragPreviewItemIds: [item.id],
    }),
    openItem: vi.fn(),
  }
}
