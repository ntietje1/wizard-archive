import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { DndMonitorCtx } from '~/features/dnd/types'
import { useElementDragMonitor } from '~/features/dnd/hooks/useElementDragMonitor'
import { SIDEBAR_ROOT_DROP_TYPE } from '~/features/dnd/utils/dnd-registry'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'

const monitorForElements = vi.fn()

vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  monitorForElements: (args: unknown) => monitorForElements(args),
}))

function createMonitorCtx(items: Array<AnySidebarItem>): DndMonitorCtx {
  const itemsMap = new Map(items.map((item) => [item._id, item]))

  return {
    itemsMap,
    trashedItemsMap: new Map(),
    allItemsMap: itemsMap,
    getAncestorIds: vi.fn(() => []),
    dndContext: {
      moveItems: vi.fn(),
      restoreItems: vi.fn(),
      trashItems: vi.fn(),
      navigateToItem: vi.fn(),
      campaignId: testId<'campaigns'>('campaign_1'),
      campaignName: 'Test Campaign',
      isDm: true,
      setFolderOpen: vi.fn(),
    },
    handleDropFiles: vi.fn(),
    campaignId: testId<'campaigns'>('campaign_1'),
  }
}

describe('useElementDragMonitor', () => {
  beforeEach(() => {
    monitorForElements.mockReset()
    monitorForElements.mockReturnValue(vi.fn())
  })

  it('shows a multi-item overlay immediately when a selected group starts dragging', () => {
    const first = createNote()
    const second = createNote()
    const ctxRef = {
      current: createMonitorCtx([first, second]),
    } as React.RefObject<DndMonitorCtx>

    const { result } = renderHook(() => useElementDragMonitor(ctxRef))
    expect(monitorForElements).toHaveBeenCalled()
    const monitor = monitorForElements.mock.calls[0]?.[0] as {
      onDragStart: (args: {
        source: { data: Record<string, unknown> }
        location: { current: { input: { clientX: number; clientY: number } } }
      }) => void
    }

    act(() => {
      monitor.onDragStart({
        source: {
          data: {
            sidebarItemId: first._id,
            sidebarItemIds: [first._id, second._id] satisfies Array<Id<'sidebarItems'>>,
          },
        },
        location: {
          current: {
            input: { clientX: 10, clientY: 20 },
          },
        },
      })
    })

    expect(result.current.dragState?.draggedItem).toBe(first)
    expect(result.current.dragState?.draggedItemCount).toBe(2)
  })

  it('counts explicitly selected descendants in the overlay even when drag operations are normalized', () => {
    const folder = createFolder()
    const firstChild = createNote({ parentId: folder._id })
    const secondChild = createNote({ parentId: folder._id })
    const ctxRef = {
      current: createMonitorCtx([folder, firstChild, secondChild]),
    } as React.RefObject<DndMonitorCtx>

    const { result } = renderHook(() => useElementDragMonitor(ctxRef))
    expect(monitorForElements).toHaveBeenCalled()
    const monitor = monitorForElements.mock.calls[0]?.[0] as {
      onDragStart: (args: {
        source: { data: Record<string, unknown> }
        location: { current: { input: { clientX: number; clientY: number } } }
      }) => void
      onDrag: (args: {
        source: { data: Record<string, unknown> }
        location: {
          current: {
            input: { clientX: number; clientY: number }
            dropTargets: Array<{ data: Record<string, unknown> }>
          }
        }
      }) => void
    }
    // `source.data` models a normalization edge case: firstChild is the actual dragged
    // element, sidebarItemIds contains the normalized folder root, and
    // sidebarDragPreviewItemIds keeps folder plus children visible in the preview.
    const source = {
      data: {
        sidebarItemId: firstChild._id,
        sidebarItemIds: [folder._id] satisfies Array<Id<'sidebarItems'>>,
        sidebarDragPreviewItemIds: [folder._id, firstChild._id, secondChild._id] satisfies Array<
          Id<'sidebarItems'>
        >,
      },
    }

    act(() => {
      monitor.onDragStart({
        source,
        location: {
          current: {
            input: { clientX: 10, clientY: 20 },
          },
        },
      })
    })

    expect(result.current.dragState?.draggedItem).toBe(folder)
    expect(result.current.dragState?.draggedItemCount).toBe(3)

    act(() => {
      monitor.onDrag({
        source,
        location: {
          current: {
            input: { clientX: 20, clientY: 30 },
            dropTargets: [{ data: { type: SIDEBAR_ROOT_DROP_TYPE } }],
          },
        },
      })
    })

    expect(result.current.dragState?.draggedItemCount).toBe(3)
  })
})
