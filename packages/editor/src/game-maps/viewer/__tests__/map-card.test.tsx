import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import type { MapItem } from '../../../game-maps/item-contract'
import { RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'
import { MapCard } from '../card'
import type { ResourceItemCardProps } from '../../../filesystem/cards/shell'

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
    sidebarItemId: 'map-1',
    sidebarItemIds: ['map-1'],
    dragPreviewItemIds: ['map-1'],
  }),
}))

vi.mock('../../../workspace/sidebar/use-item-selection-interactions', () => ({
  useItemSelectionInteractions: () => ({
    handleItemClick: vi.fn(),
    handleItemContextMenu: vi.fn(),
  }),
}))

vi.mock('../../../workspace/sidebar/use-sidebar-item-visual-state', () => ({
  useSidebarItemVisualState: () => ({}),
}))

describe('MapCard', () => {
  it('renders the preview image without the unavailable placeholder', () => {
    render(<MapCard item={createMapItem()} source={createSource()} />)

    expect(screen.getByAltText('Lost Mine')).toBeInTheDocument()
    expect(screen.queryByText('Map preview unavailable')).not.toBeInTheDocument()
  })

  it('falls back to the map preview placeholder when the preview image fails to load', () => {
    render(<MapCard item={createMapItem()} source={createSource()} />)

    fireEvent.error(screen.getByAltText('Lost Mine'))

    expect(screen.getByText('Map preview unavailable')).toBeInTheDocument()
  })
})

function createMapItem(): MapItem {
  return {
    id: 'map-1' as SidebarItemId,
    name: 'Lost Mine',
    previewUrl: 'https://example.com/map.png',
    type: RESOURCE_TYPES.gameMaps,
  } as unknown as MapItem
}

function createSource(): ResourceItemCardProps<MapItem>['source'] {
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
