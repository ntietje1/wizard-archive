import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { ResourceItemCardShell } from '../shell'
import type { ResourceItemCardProps } from '../shell'
import type { AnyItem } from '../../../workspace/items'
import { RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'
import type { SidebarItemId } from '../../../../../../shared/common/ids'

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
  useDraggable: () => ({ isDraggingRef: { current: false } }),
}))

vi.mock('../../../drag-drop/sidebar-drag-data', () => ({
  useSidebarDragData: () => ({
    sidebarItemId: 'note-1',
    sidebarItemIds: ['note-1'],
    dragPreviewItemIds: ['note-1'],
  }),
}))

const { handleItemClickMock } = vi.hoisted(() => ({ handleItemClickMock: vi.fn() }))

vi.mock('../../../workspace/sidebar/use-item-selection-interactions', () => ({
  useItemSelectionInteractions: () => ({
    handleItemClick: handleItemClickMock,
    handleItemContextMenu: vi.fn(),
  }),
}))

describe('ResourceItemCardShell', () => {
  it('names the item targeted by the action menu', () => {
    render(
      <ResourceItemCardShell
        item={createItem('Lost Mine Clues')}
        source={createSource()}
        preview={<div>Preview</div>}
        visualState={{}}
      />,
    )

    expect(screen.getByRole('button', { name: 'More options for Lost Mine Clues' })).toBeEnabled()
  })

  it('lets selection intent decide whether the card action runs', () => {
    const onClick = vi.fn()
    render(
      <ResourceItemCardShell
        item={createItem('Lost Mine Clues')}
        source={createSource()}
        preview={<div>Preview</div>}
        visualState={{}}
        onClick={onClick}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Lost Mine Clues' }), { ctrlKey: true })

    expect(onClick).not.toHaveBeenCalled()
    expect(handleItemClickMock).toHaveBeenCalledWith(expect.anything(), onClick)
  })
})

function createSource(): ResourceItemCardProps<AnyItem>['source'] {
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

function createItem(name: string): AnyItem {
  return {
    id: 'note-1' as SidebarItemId,
    name,
    type: RESOURCE_TYPES.notes,
  } as unknown as AnyItem
}
