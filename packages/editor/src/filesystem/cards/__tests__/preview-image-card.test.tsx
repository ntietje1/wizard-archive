import type { ResourceId } from '../../../resources/domain-id'
import type { ReactNode } from 'react'
import { Image } from 'lucide-react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { PreviewImageResourceItemCard } from '../preview-image-card'
import type { ResourceItemCardProps } from '../shell'
import type { AnyItem } from '../../../workspace/items'
import { RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'

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
    sidebarItemId: 'canvas-1',
    sidebarItemIds: ['canvas-1'],
    dragPreviewItemIds: ['canvas-1'],
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

describe('PreviewImageResourceItemCard', () => {
  it('keeps preview images out of native browser dragging by default', () => {
    render(<PreviewImageResourceItemCard {...cardProps()} />)

    expect(screen.getByRole('img', { name: 'Preview of Canvas' })).toHaveAttribute(
      'draggable',
      'false',
    )
  })

  it('allows preview image dragging only when explicitly enabled', () => {
    render(<PreviewImageResourceItemCard {...cardProps({ imageDraggable: true })} />)

    expect(screen.getByRole('img', { name: 'Preview of Canvas' })).toHaveAttribute(
      'draggable',
      'true',
    )
  })
})

function cardProps(
  overrides: Partial<Parameters<typeof PreviewImageResourceItemCard<AnyItem>>[0]> = {},
): Parameters<typeof PreviewImageResourceItemCard<AnyItem>>[0] {
  return {
    fallbackIcon: Image,
    fallbackLabel: 'Preview unavailable',
    imageAlt: (item) => `Preview of ${item.name}`,
    item: createItem(),
    source: createSource(),
    ...overrides,
  }
}

function createSource(): ResourceItemCardProps<AnyItem>['source'] {
  return {
    canDragItem: () => true,
    currentItemId: null,
    getSidebarDragData: (item) => ({
      sidebarItemId: item.id,
      sidebarItemIds: [item.id],
      dragPreviewItemIds: [item.id],
    }),
    openItem: vi.fn(),
  }
}

function createItem(): AnyItem {
  return {
    id: 'canvas-1' as ResourceId,
    name: 'Canvas',
    type: RESOURCE_TYPES.canvases,
    previewUrl: 'https://example.com/canvas.png',
  } as unknown as AnyItem
}
