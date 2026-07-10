import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { AnyItem } from '../../workspace/items'
import type { ElementDragMonitorContext } from '../monitor-context'
import { useElementDragMonitor } from '../use-element-drag-monitor'
import { useDndStore } from '../store'
import { resetDndStore } from './store-test-utils'
import {
  EMPTY_EMBED_DROP_TYPE,
  MAP_DROP_ZONE_TYPE,
  NOTE_EDITOR_DROP_TYPE,
  SIDEBAR_ROOT_DROP_TYPE,
} from '../drop-target-data'
import {
  createFolder as createFolderFixture,
  createNote as createNoteFixture,
} from '../../test/sidebar-item-factory'
import { testId } from '../../test/id'
import { registerSurfaceDropExecutor } from '../surface-command'
import { createResourceCatalogModel } from '../../filesystem/catalog'

const monitorForElements = vi.fn()
const campaignId = testId<'campaigns'>('campaign_1')

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
      input: { clientX: number; clientY: number; ctrlKey?: boolean; shiftKey?: boolean }
      dropTargets: Array<{ data: Record<string, unknown> }>
    }
  }
}
type DropArgs = DragArgs
type ElementMonitor = {
  onDragStart: (args: DragStartArgs) => void
  onDrag: (args: DragArgs) => void
  onDropTargetChange: (args: DragArgs) => void
  onDrop: (args: DropArgs) => Promise<void>
}

function createNote(overrides: Parameters<typeof createNoteFixture>[0] = {}) {
  return createNoteFixture({ campaignId, ...overrides })
}

function createFolder(overrides: Parameters<typeof createFolderFixture>[0] = {}) {
  return createFolderFixture({ campaignId, ...overrides })
}

function createMonitorCtx(items: Array<AnyItem>): ElementDragMonitorContext {
  const activeItems = items.filter((item) => !item.isTrashed)
  const trashItems = items.filter((item) => item.isTrashed)

  const { catalog, operationItems } = createResourceCatalogModel({
    activeItems,
    trashItems,
  })

  return {
    catalog,
    dndContext: {
      executeFileSystemCommand: vi.fn().mockResolvedValue({
        status: 'completed',
        receipt: null,
      }),
      openItem: vi.fn(),
    },
    dropPlanningContext: {
      workspaceId: campaignId,
      workspaceName: 'Test Campaign',
      canCreateRootItems: true,
      canManageFolders: true,
    },
    operationItems,
  }
}

function getElementMonitor(): ElementMonitor {
  expect(monitorForElements).toHaveBeenCalledTimes(1)
  return monitorForElements.mock.calls[0]?.[0] as ElementMonitor
}

function createSidebarSource(
  itemId: SidebarItemId,
  itemIds: Array<SidebarItemId>,
  previewItemIds?: Array<SidebarItemId>,
): DragSource {
  return {
    data: {
      sidebarItemId: itemId,
      sidebarItemIds: itemIds,
      ...(previewItemIds ? { dragPreviewItemIds: previewItemIds } : {}),
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
    resetDndStore()
  })

  it('shows a multi-item overlay immediately when a selected group starts dragging', () => {
    const first = createNote()
    const second = createNote()
    const ctxRef = {
      current: createMonitorCtx([first, second]),
    } as React.RefObject<ElementDragMonitorContext>

    const { result } = renderHook(() => useElementDragMonitor(ctxRef))
    const monitor = getElementMonitor()

    act(() => {
      startDrag(monitor, createSidebarSource(first.id, [first.id, second.id]))
    })

    expect(result.current.dragState?.draggedItem?.id).toBe(first.id)
    expect(result.current.dragState?.draggedItemCount).toBe(2)
    expect(useDndStore.getState().dragPreviewItemIds).toEqual([first.id, second.id])
  })

  it('counts explicitly selected descendants in the overlay even when drag operations are normalized', () => {
    const folder = createFolder()
    const firstChild = createNote({ parentId: folder.id })
    const secondChild = createNote({ parentId: folder.id })
    const ctxRef = {
      current: createMonitorCtx([folder, firstChild, secondChild]),
    } as React.RefObject<ElementDragMonitorContext>

    const { result } = renderHook(() => useElementDragMonitor(ctxRef))
    const monitor = getElementMonitor()
    // `source.data` models a normalization edge case: firstChild is the actual dragged
    // element, sidebarItemIds contains the normalized folder root, and
    // dragPreviewItemIds keeps folder plus children visible in the preview.
    const source = createSidebarSource(
      firstChild.id,
      [folder.id],
      [folder.id, firstChild.id, secondChild.id],
    )

    act(() => {
      startDrag(monitor, source)
    })

    expect(result.current.dragState?.draggedItem?.id).toBe(folder.id)
    expect(result.current.dragState?.draggedItemCount).toBe(3)
    expect(useDndStore.getState().dragPreviewItemIds).toEqual([
      folder.id,
      firstChild.id,
      secondChild.id,
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
    } as React.RefObject<ElementDragMonitorContext>

    const { result } = renderHook(() => useElementDragMonitor(ctxRef))
    const monitor = getElementMonitor()
    const source = createSidebarSource(first.id, [first.id, second.id])

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

  it('does not advance feedback dedupe before monitor context is available', () => {
    const first = createNote()
    const second = createNote()
    const ctxRef = {
      current: null,
    } as React.MutableRefObject<ElementDragMonitorContext | null>

    renderHook(() => useElementDragMonitor(ctxRef as React.RefObject<ElementDragMonitorContext>))
    const monitor = getElementMonitor()
    const source = createSidebarSource(first.id, [first.id, second.id])
    const mapTarget = {
      type: MAP_DROP_ZONE_TYPE,
      mapId: testId<'sidebarItems'>('map_1'),
      mapName: 'World Map',
      pinnedItemIds: [],
    }

    act(() => {
      startDrag(monitor, source)
      dragOver(monitor, source, [{ data: mapTarget }])
    })

    expect(useDndStore.getState().dragOutcome).toBeNull()

    ctxRef.current = createMonitorCtx([first, second])
    act(() => {
      dragOver(monitor, source, [{ data: mapTarget }])
    })

    expect(useDndStore.getState().dragOutcome).toMatchObject({
      type: 'operation',
      action: 'pin',
      label: 'Pin 2 items to "World Map"',
    })
  })

  it('sets the generic active drop target key while dragging over a target', () => {
    const note = createNote()
    const target = createFolder()
    const ctxRef = {
      current: createMonitorCtx([note, target]),
    } as React.RefObject<ElementDragMonitorContext>

    renderHook(() => useElementDragMonitor(ctxRef))
    const monitor = getElementMonitor()
    const source = createSidebarSource(note.id, [note.id])
    const targetData = { sidebarItemId: target.id }

    act(() => {
      startDrag(monitor, source)
      dragOver(monitor, source, [{ data: targetData }])
    })

    expect(useDndStore.getState().activeDropTargetKey).toBe(`sidebar-item:${target.id}`)
  })

  it('clears generic drag state after element drop', async () => {
    const note = createNote()
    const target = createFolder()
    const ctxRef = {
      current: createMonitorCtx([note, target]),
    } as React.RefObject<ElementDragMonitorContext>

    renderHook(() => useElementDragMonitor(ctxRef))
    const monitor = getElementMonitor()
    const source = createSidebarSource(note.id, [note.id])

    act(() => {
      startDrag(monitor, source)
      dragOver(monitor, source, [{ data: { sidebarItemId: target.id } }])
    })

    await act(async () => {
      await monitor.onDrop({
        source,
        location: {
          current: {
            input: { clientX: 20, clientY: 30 },
            dropTargets: [{ data: { sidebarItemId: target.id } }],
          },
        },
      })
    })

    expect(useDndStore.getState()).toMatchObject({
      activeDropTargetKey: null,
      dragPreviewItemIds: [],
      dragOutcome: null,
      isDraggingElement: false,
    })
  })

  it('shows partial batch warnings for map pin drops', () => {
    const first = createNote()
    const second = createNote()
    const ctxRef = {
      current: createMonitorCtx([first, second]),
    } as React.RefObject<ElementDragMonitorContext>

    const { result } = renderHook(() => useElementDragMonitor(ctxRef))
    const monitor = getElementMonitor()
    const source = createSidebarSource(first.id, [first.id, second.id])

    act(() => {
      startDrag(monitor, source)
      dragOver(monitor, source, [
        {
          data: {
            type: MAP_DROP_ZONE_TYPE,
            mapId: testId<'sidebarItems'>('map_1'),
            mapName: 'World Map',
            pinnedItemIds: [second.id],
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

  it('executes registered note embed executors for empty embed drops', async () => {
    const sourceItem = createNote()
    const targetItem = createNote()
    const ctx = createMonitorCtx([sourceItem, targetItem])
    const ctxRef = {
      current: ctx,
    } as React.RefObject<ElementDragMonitorContext>
    const target = {
      type: EMPTY_EMBED_DROP_TYPE,
      sourceItemId: targetItem.id,
      embedBlockId: 'embed-block-1',
    }
    const execute = vi.fn(() => Promise.resolve())
    const dispose = registerSurfaceDropExecutor({
      action: 'noteEmbed',
      target,
      execute,
    })

    try {
      const { result } = renderHook(() => useElementDragMonitor(ctxRef))
      const monitor = getElementMonitor()
      const source = createSidebarSource(sourceItem.id, [sourceItem.id])

      act(() => {
        startDrag(monitor, source)
        dragOver(monitor, source, [{ data: target }])
      })

      expect(result.current.dragState?.outcome).toMatchObject({
        type: 'operation',
        action: 'embed',
        label: 'Embed item here',
      })
      expect(useDndStore.getState().dragOutcome).toMatchObject({
        type: 'operation',
        action: 'embed',
        label: 'Embed item here',
      })

      await act(async () => {
        await monitor.onDrop({
          source,
          location: {
            current: {
              input: { clientX: 20, clientY: 30 },
              dropTargets: [{ data: target }],
            },
          },
        })
      })

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ready',
          commandId: 'surface-drop.embed-sidebar-item-in-note',
          action: 'noteEmbed',
          items: [sourceItem],
        }),
        expect.objectContaining({ clientX: 20, clientY: 30 }),
      )
    } finally {
      dispose()
    }
  })

  it('updates embed overlay feedback when the drop target changes without another drag tick', () => {
    const sourceItem = createNote()
    const targetItem = createNote()
    const ctxRef = {
      current: createMonitorCtx([sourceItem, targetItem]),
    } as React.RefObject<ElementDragMonitorContext>

    const { result } = renderHook(() => useElementDragMonitor(ctxRef))
    const monitor = getElementMonitor()
    const source = createSidebarSource(sourceItem.id, [sourceItem.id])

    act(() => {
      startDrag(monitor, source)
      monitor.onDropTargetChange({
        source,
        location: {
          current: {
            input: { clientX: 20, clientY: 30 },
            dropTargets: [
              {
                data: {
                  type: EMPTY_EMBED_DROP_TYPE,
                  sourceItemId: targetItem.id,
                  embedBlockId: 'embed-block-1',
                },
              },
            ],
          },
        },
      })
    })

    expect(result.current.dragState?.outcome).toMatchObject({
      type: 'operation',
      action: 'embed',
      label: 'Embed item here',
    })
    expect(useDndStore.getState().dragOutcome).toMatchObject({
      type: 'operation',
      action: 'embed',
      label: 'Embed item here',
    })
  })

  it('dispatches registered runtime-scoped surface executors from the central monitor', async () => {
    const note = createNote()
    const ctx = {
      ...createMonitorCtx([note]),
      runtimeId: 'runtime-a',
    }
    const ctxRef = {
      current: ctx,
    } as React.RefObject<ElementDragMonitorContext>
    const target = {
      type: MAP_DROP_ZONE_TYPE,
      mapId: testId<'sidebarItems'>('map_1'),
      mapName: 'World Map',
      pinnedItemIds: [],
      __wizardArchiveDndRuntimeId: 'runtime-a',
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
          source: createSidebarSource(note.id, [note.id]),
          location: {
            current: {
              input: { clientX: 20, clientY: 30 },
              dropTargets: [{ data: target }],
            },
          },
        })
      })

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ready',
          commandId: 'surface-drop.pin-sidebar-item-to-map',
          action: 'pin',
          items: [note],
        }),
        expect.objectContaining({ clientX: 20, clientY: 30 }),
      )
    } finally {
      dispose()
    }
  })

  it('ignores surface targets owned by another DnD runtime instance', async () => {
    const note = createNote()
    const ctx = {
      ...createMonitorCtx([note]),
      runtimeId: 'runtime-b',
    }
    const ctxRef = {
      current: ctx,
    } as React.RefObject<ElementDragMonitorContext>
    const target = {
      type: MAP_DROP_ZONE_TYPE,
      mapId: testId<'sidebarItems'>('map_1'),
      mapName: 'World Map',
      pinnedItemIds: [],
      __wizardArchiveDndRuntimeId: 'runtime-a',
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
          source: createSidebarSource(note.id, [note.id]),
          location: {
            current: {
              input: { clientX: 20, clientY: 30 },
              dropTargets: [{ data: target }],
            },
          },
        })
      })

      expect(execute).not.toHaveBeenCalled()
      expect(ctx.dndContext.executeFileSystemCommand).not.toHaveBeenCalled()
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
    } as React.RefObject<ElementDragMonitorContext>

    renderHook(() => useElementDragMonitor(ctxRef))
    const monitor = getElementMonitor()

    act(() => {
      monitor.onDrag({
        source: createSidebarSource(note.id, [note.id]),
        location: {
          current: {
            input: { clientX: 20, clientY: 30, ctrlKey: true },
            dropTargets: [
              {
                data: { sidebarItemId: target.id },
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
        source: createSidebarSource(note.id, [note.id]),
        location: {
          current: {
            input: { clientX: 20, clientY: 30, ctrlKey: true },
            dropTargets: [
              {
                data: { sidebarItemId: target.id },
              },
            ],
          },
        },
      })
    })

    expect(ctx.dndContext.executeFileSystemCommand).toHaveBeenCalledTimes(1)
    expect(ctx.dndContext.executeFileSystemCommand).toHaveBeenCalledWith({
      type: 'copy',
      itemIds: [note.id],
      targetParentId: target.id,
    })
  })

  it('does not execute filesystem drops for partially resolved drag selections', async () => {
    const note = createNote()
    const target = createFolder()
    const missingItemId = testId<'sidebarItems'>('missing_note')
    const ctx = createMonitorCtx([note, target])
    const ctxRef = {
      current: ctx,
    } as React.RefObject<ElementDragMonitorContext>

    renderHook(() => useElementDragMonitor(ctxRef))
    const monitor = getElementMonitor()

    await act(async () => {
      await monitor.onDrop({
        source: createSidebarSource(note.id, [note.id, missingItemId]),
        location: {
          current: {
            input: { clientX: 20, clientY: 30 },
            dropTargets: [
              {
                data: { sidebarItemId: target.id },
              },
            ],
          },
        },
      })
    })

    expect(ctx.dndContext.executeFileSystemCommand).not.toHaveBeenCalled()
  })

  it('does not show successful feedback for partially resolved drag selections', () => {
    const note = createNote()
    const target = createFolder()
    const missingItemId = testId<'sidebarItems'>('missing_note')
    const ctx = createMonitorCtx([note, target])
    const ctxRef = {
      current: ctx,
    } as React.RefObject<ElementDragMonitorContext>

    const { result } = renderHook(() => useElementDragMonitor(ctxRef))
    const monitor = getElementMonitor()
    const source = createSidebarSource(note.id, [note.id, missingItemId])

    act(() => {
      startDrag(monitor, source)
      dragOver(monitor, source, [
        {
          data: { sidebarItemId: target.id },
        },
      ])
    })

    expect(result.current.dragState?.outcome).toBeNull()
    expect(useDndStore.getState().dragOutcome).toBeNull()
    expect(useDndStore.getState().activeDropTargetKey).toBeNull()
  })

  it('executes shift-drag note drops into note editors as embed commands', async () => {
    const note = createNote()
    const targetNote = createNote()
    const ctx = createMonitorCtx([note, targetNote])
    const ctxRef = {
      current: ctx,
    } as React.RefObject<ElementDragMonitorContext>
    const target = {
      type: NOTE_EDITOR_DROP_TYPE,
      noteId: targetNote.id,
    }
    const execute = vi.fn(() => Promise.resolve())
    const dispose = registerSurfaceDropExecutor({
      action: 'noteEmbed',
      target,
      execute,
    })

    try {
      renderHook(() => useElementDragMonitor(ctxRef))
      const monitor = getElementMonitor()
      const source = createSidebarSource(note.id, [note.id])

      act(() => {
        monitor.onDrag({
          source,
          location: {
            current: {
              input: { clientX: 20, clientY: 30, shiftKey: true },
              dropTargets: [{ data: target }],
            },
          },
        })
      })
      expect(useDndStore.getState().dragOutcome).toMatchObject({
        type: 'operation',
        action: 'embed',
        label: 'Embed item here',
      })

      await act(async () => {
        await monitor.onDrop({
          source,
          location: {
            current: {
              input: { clientX: 20, clientY: 30, shiftKey: true },
              dropTargets: [{ data: target }],
            },
          },
        })
      })

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ready',
          commandId: 'surface-drop.embed-sidebar-item-in-note',
          action: 'noteEmbed',
          items: [note],
        }),
        expect.objectContaining({ clientX: 20, clientY: 30, shiftKey: true }),
      )
    } finally {
      dispose()
    }
  })
})
