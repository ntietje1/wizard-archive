import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vite-plus/test'

import {
  createSidebarWorkspaceStateHarness,
  createSidebarWorkspaceStateWrapper,
} from '../../../workspace/sidebar/__tests__/test-helpers'
import { TRASH_DROP_ZONE_TYPE } from '../../../drag-drop/drop-target-data'
import type { TrashSource } from '../source'
import { TrashPageViewer } from '../page-viewer'

const dropTargetCalls = vi.hoisted(
  () =>
    [] as Array<{
      canDrop?: boolean
      data: Record<string, unknown>
    }>,
)

vi.mock('../../../drag-drop/use-drop-target', () => ({
  useDndDropTarget: (options: { canDrop?: boolean; data: Record<string, unknown> }) => {
    dropTargetCalls.push(options)
    return { dropTargetRef: vi.fn(), dropTargetKey: 'trash-drop-zone', isDropTarget: false }
  },
}))

vi.mock('../../../workspace/context-menu/context-menu', () => ({
  WorkspaceContextMenu: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

describe('TrashPageViewer', () => {
  it('activates the trash item surface from the empty state', () => {
    const sidebar = createSidebarWorkspaceStateHarness()

    render(
      <TrashPageViewerTestProvider sidebar={sidebar}>
        <TrashPageViewer source={createTrashSource()} />
      </TrashPageViewerTestProvider>,
    )

    fireEvent.pointerDown(screen.getByText('Trash is empty'))

    expect(sidebar.current.selection.activeItemSurface).toEqual({
      surface: 'trash',
      parentId: null,
      visibleItemIds: [],
    })
  })

  it('offers retry when trash loading fails', () => {
    const sidebar = createSidebarWorkspaceStateHarness()
    const refresh = vi.fn()

    render(
      <TrashPageViewerTestProvider sidebar={sidebar}>
        <TrashPageViewer
          source={createTrashSource({
            getError: () => new Error('trash failed'),
            getStatus: () => 'error',
            refresh,
          })}
        />
      </TrashPageViewerTestProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Retry loading trash' }))

    expect(refresh).toHaveBeenCalledOnce()
  })

  it('registers the trash view as a filesystem drop target without a source permission gate', () => {
    const sidebar = createSidebarWorkspaceStateHarness()

    render(
      <TrashPageViewerTestProvider sidebar={sidebar}>
        <TrashPageViewer source={createTrashSource()} />
      </TrashPageViewerTestProvider>,
    )

    expect(dropTargetCalls.at(-1)).toEqual({
      data: { type: TRASH_DROP_ZONE_TYPE },
    })
  })
})

function TrashPageViewerTestProvider({
  children,
  sidebar,
}: {
  children: ReactNode
  sidebar: ReturnType<typeof createSidebarWorkspaceStateHarness>
}) {
  const Wrapper = createSidebarWorkspaceStateWrapper({
    workspaceId: sidebar.workspaceId,
    sort: sidebar.sort,
  })
  return <Wrapper>{children}</Wrapper>
}

function createTrashSource(overrides: Partial<TrashSource> = {}): TrashSource {
  return {
    canDeleteItemForever: () => true,
    canDragItem: () => false,
    canEmptyTrash: () => false,
    canRestoreItem: () => true,
    currentItemId: null,
    getDeletedByName: () => undefined,
    getError: () => null,
    getItemCount: () => 0,
    getRootItems: () => [],
    getSidebarDragData: (item) => ({
      dragPreviewItemIds: [item.id],
      sidebarItemId: item.id,
      sidebarItemIds: [item.id],
    }),
    getStatus: () => 'success',
    isTrashActive: () => true,
    openItem: vi.fn(),
    openTrash: vi.fn(),
    refresh: vi.fn(),
    requestDeleteItemsForever: vi.fn(),
    requestEmptyTrash: vi.fn(),
    restoreItems: vi.fn(),
    ...overrides,
  }
}
