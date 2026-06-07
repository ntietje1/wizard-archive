import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { DndMonitorCtx } from '~/features/dnd/types'
import { useElementDragMonitor } from '~/features/dnd/hooks/useElementDragMonitor'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { MAP_DROP_ZONE_TYPE, SIDEBAR_ROOT_DROP_TYPE } from '~/features/dnd/utils/drop-target-data'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'
import { registerSurfaceDropExecutor } from '~/features/dnd/utils/surface-drop-command'

const monitorForElements = vi.fn()

vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  monitorForElements: (args: unknown) => monitorForElements(args),
}))

type DragSource = { data: Record<string, unknown> }
type DragStartArgs = {
  source: DragSource
  location: { current: { input: { clientX: number; clientY: number } } }
}
type DragArgs = {
  source: DragSource
  location: {
    current: {
      input: { clientX: number; clientY: number; ctrlKey?: boolean }
      dropTargets: Array<{ data: Record<string, unknown> }>
    }
  }
}
type DropArgs = {
  source: DragSource
  location: {
    current: {
      input: { clientX: number; clientY: number; ctrlKey?: boolean }
      dropTargets: Array<{ data: Record<string, unknown> }>
    }
  }
}
type ElementMonitor = {
  onDragStart: (args: DragStartArgs) => void
  onDrag: (args: DragArgs) => void
  onDrop: (args: DropArgs) => Promise<void>
}

function createMonitorCtx(items: Array<AnySidebarItem>): DndMonitorCtx {
  const itemsMap = new Map(items.map((item) => [item._id, item]))

  return {
    itemsMap,
    trashedItemsMap: new Map(),
    allItemsMap: itemsMap,
    getAncestorIds: vi.fn(() => []),
    dndContext: {
      executeFileSystemDrop: vi.fn(),
      openItem: vi.fn(),
    },
    dropPlanningContext: {
      campaignId: testId<'campaigns'>('campaign_1'),
      campaignName: 'Test Campaign',
      isDm: true,
    },
    handleDropFiles: vi.fn(),
    campaignId: testId<'campaigns'>('campaign_1'),
  }
}

function getElementMonitor(): ElementMonitor {
  expect(monitorForElements).toHaveBeenCalledTimes(1)
  return monitorForElements.mock.calls[0]?.[0] as ElementMonitor
}

function createSidebarSource(
  itemId: Id<'sidebarItems'>,
  itemIds: Array<Id<'sidebarItems'>>,
  previewItemIds?: Array<Id<'sidebarItems'>>,
): DragSource {
  return {
    data: {
      sidebarItemId: itemId,
      sidebarItemIds: itemIds,
      ...(previewItemIds ? { sidebarDragPreviewItemIds: previewItemIds } : {}),
    },
  }
}

function startDrag(monitor: ElementMonitor, source: DragSource) {
  monitor.onDragStart({
    source,
    location: { current: { input: { clientX: 10, clientY: 20 } } },
  })
}

function dragOver(
  monitor: ElementMonitor,
  source: DragSource,
  dropTargets: DragArgs['location']['current']['dropTargets'],
) {
  monitor.onDrag({
    source,
    location: {
      current: {
        input: { clientX: 20, clientY: 30 },
        dropTargets,
      },
    },
  })
}

describe('useElementDragMonitor', () => {
  beforeEach(() => {
    monitorForElements.mockReset()
    monitorForElements.mockReturnValue(vi.fn())
    useDndStore.getState().setSidebarDragPreviewItemIds([])
  })

  it('shows a multi-item overlay immediately when a selected group starts dragging', () => {
    const first = createNote()
    const second = createNote()
    const ctxRef = {
      current: createMonitorCtx([first, second]),
    } as React.RefObject<DndMonitorCtx>

    const { result } = renderHook(() => useElementDragMonitor(ctxRef))
    const monitor = getElementMonitor()

    act(() => {
      startDrag(monitor, createSidebarSource(first._id, [first._id, second._id]))
    })

    expect(result.current.dragState?.draggedItem).toBe(first)
    expect(result.current.dragState?.draggedItemCount).toBe(2)
    expect(useDndStore.getState().sidebarDragPreviewItemIds).toEqual([first._id, second._id])
  })

  it('counts explicitly selected descendants in the overlay even when drag operations are normalized', () => {
    const folder = createFolder()
    const firstChild = createNote({ parentId: folder._id })
    const secondChild = createNote({ parentId: folder._id })
    const ctxRef = {
      current: createMonitorCtx([folder, firstChild, secondChild]),
    } as React.RefObject<DndMonitorCtx>

    const { result } = renderHook(() => useElementDragMonitor(ctxRef))
    const monitor = getElementMonitor()
    // `source.data` models a normalization edge case: firstChild is the actual dragged
    // element, sidebarItemIds contains the normalized folder root, and
    // sidebarDragPreviewItemIds keeps folder plus children visible in the preview.
    const source = createSidebarSource(
      firstChild._id,
      [folder._id],
      [folder._id, firstChild._id, secondChild._id],
    )

    act(() => {
      startDrag(monitor, source)
    })

    expect(result.current.dragState?.draggedItem).toBe(folder)
    expect(result.current.dragState?.draggedItemCount).toBe(3)
    expect(useDndStore.getState().sidebarDragPreviewItemIds).toEqual([
      folder._id,
      firstChild._id,
      secondChild._id,
    ])

    act(() => {
      dragOver(monitor, source, [{ data: { type: SIDEBAR_ROOT_DROP_TYPE } }])
    })

    expect(result.current.dragState?.draggedItemCount).toBe(3)
  })

  it('shows the batch operation label for map pin drops', () => {
    const first = createNote()
    const second = createNote()
    const ctxRef = {
      current: createMonitorCtx([first, second]),
    } as React.RefObject<DndMonitorCtx>

    const { result } = renderHook(() => useElementDragMonitor(ctxRef))
    const monitor = getElementMonitor()
    const source = createSidebarSource(first._id, [first._id, second._id])

    act(() => {
      startDrag(monitor, source)
      dragOver(monitor, source, [
        {
          data: {
            type: MAP_DROP_ZONE_TYPE,
            mapId: testId<'sidebarItems'>('map_1'),
            mapName: 'World Map',
            pinnedItemIds: [],
          },
        },
      ])
    })

    expect(result.current.dragState?.outcome).toMatchObject({
      type: 'operation',
      action: 'pin',
      label: 'Pin 2 items to "World Map"',
    })
  })

  it('shows partial batch warnings for map pin drops', () => {
    const first = createNote()
    const second = createNote()
    const ctxRef = {
      current: createMonitorCtx([first, second]),
    } as React.RefObject<DndMonitorCtx>

    const { result } = renderHook(() => useElementDragMonitor(ctxRef))
    const monitor = getElementMonitor()
    const source = createSidebarSource(first._id, [first._id, second._id])

    act(() => {
      startDrag(monitor, source)
      dragOver(monitor, source, [
        {
          data: {
            type: MAP_DROP_ZONE_TYPE,
            mapId: testId<'sidebarItems'>('map_1'),
            mapName: 'World Map',
            pinnedItemIds: [second._id],
          },
        },
      ])
    })

    expect(result.current.dragState?.outcome).toMatchObject({
      type: 'operation',
      action: 'pin',
      label: 'Pin item to "World Map"',
    })
    expect(result.current.dragState?.rejectedItemCount).toBe(1)
  })

  it('dispatches registered surface executors from the central monitor', async () => {
    const note = createNote()
    const ctx = createMonitorCtx([note])
    const ctxRef = {
      current: ctx,
    } as React.RefObject<DndMonitorCtx>
    const target = {
      type: MAP_DROP_ZONE_TYPE,
      mapId: testId<'sidebarItems'>('map_1'),
      mapName: 'World Map',
      pinnedItemIds: [],
    }
    const execute = vi.fn(() => Promise.resolve())
    const dispose = registerSurfaceDropExecutor({
      action: 'pin',
      target,
      execute,
    })

    try {
      renderHook(() => useElementDragMonitor(ctxRef))
      const monitor = getElementMonitor()

      await act(async () => {
        await monitor.onDrop({
          source: createSidebarSource(note._id, [note._id]),
          location: {
            current: {
              input: { clientX: 20, clientY: 30 },
              dropTargets: [{ data: target }],
            },
          },
        })
      })

      expect(ctx.dndContext.executeFileSystemDrop).not.toHaveBeenCalled()
      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ready',
          commandId: 'surface-drop.pin-sidebar-item-to-map',
          action: 'pin',
          items: [note],
        }),
        { clientX: 20, clientY: 30 },
      )
    } finally {
      dispose()
    }
  })

  it('executes ctrl-drag note drops onto folders as one copy operation', async () => {
    const note = createNote()
    const target = createFolder()
    const ctx = createMonitorCtx([note, target])
    const ctxRef = {
      current: ctx,
    } as React.RefObject<DndMonitorCtx>

    renderHook(() => useElementDragMonitor(ctxRef))
    const monitor = getElementMonitor()

    act(() => {
      monitor.onDrag({
        source: createSidebarSource(note._id, [note._id]),
        location: {
          current: {
            input: { clientX: 20, clientY: 30, ctrlKey: true },
            dropTargets: [
              {
                data: { sidebarItemId: target._id },
              },
            ],
          },
        },
      })
    })
    expect(useDndStore.getState().dragOutcome).toMatchObject({
      type: 'operation',
      action: 'copy',
    })

    await act(async () => {
      await monitor.onDrop({
        source: createSidebarSource(note._id, [note._id]),
        location: {
          current: {
            input: { clientX: 20, clientY: 30, ctrlKey: true },
            dropTargets: [
              {
                data: { sidebarItemId: target._id },
              },
            ],
          },
        },
      })
    })

    expect(ctx.dndContext.executeFileSystemDrop).toHaveBeenCalledTimes(1)
    expect(ctx.dndContext.executeFileSystemDrop).toHaveBeenCalledWith(
      expect.objectContaining({
        itemIds: [note._id],
        target: expect.objectContaining({
          type: 'folder',
          folder: expect.objectContaining({ _id: target._id }),
        }),
        options: { copy: true },
      }),
    )
  })
})
