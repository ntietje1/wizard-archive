import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DndMonitorCtx } from '~/features/dnd/types'
import type { DropResult } from '~/features/file-upload/utils/folder-reader'
import {
  EMPTY_EDITOR_DROP_TYPE,
  NOTE_EDITOR_DROP_TYPE,
  SIDEBAR_ROOT_DROP_TYPE,
} from '~/features/dnd/utils/drop-target-data'
import { registerExternalFileDropExecutor } from '~/features/dnd/utils/external-file-drop-command'
import { useDndStore } from '~/features/dnd/stores/dnd-store'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { testId } from '~/test/helpers/test-id'
import { useExternalDragMonitor } from '../useExternalDragMonitor'

const monitorForExternal = vi.hoisted(() => vi.fn())
const processDataTransferItems = vi.hoisted(() => vi.fn())

vi.mock('@atlaskit/pragmatic-drag-and-drop/external/adapter', () => ({
  monitorForExternal: (args: unknown) => monitorForExternal(args),
}))

vi.mock('@atlaskit/pragmatic-drag-and-drop/external/file', () => ({
  containsFiles: () => true,
}))

vi.mock('~/features/file-upload/utils/folder-reader', () => ({
  processDataTransferItems,
}))

type ExternalMonitor = {
  onDragStart: () => void
  onDropTargetChange: (args: {
    location: {
      current: {
        dropTargets: Array<{ data: Record<string, unknown> }>
      }
    }
  }) => void
  onDrop: (args: {
    source: { items: ReadonlyArray<DataTransferItem> }
    location: {
      current: {
        input: { clientX: number; clientY: number }
        dropTargets: Array<{ data: Record<string, unknown> }>
      }
    }
  }) => Promise<void>
}

function createMonitorCtx(): DndMonitorCtx {
  return {
    itemsMap: new Map(),
    trashedItemsMap: new Map(),
    allItemsMap: new Map(),
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

function getExternalMonitor(): ExternalMonitor {
  expect(monitorForExternal).toHaveBeenCalledTimes(1)
  return monitorForExternal.mock.calls[0]?.[0] as ExternalMonitor
}

describe('useExternalDragMonitor', () => {
  beforeEach(() => {
    monitorForExternal.mockReset()
    monitorForExternal.mockReturnValue(vi.fn())
    processDataTransferItems.mockReset()
    useDndStore.setState({
      fileDragHoveredTargetKey: null,
      isDraggingFiles: false,
    })
  })

  it('tracks the top external file drop target without treating note editors as sidebar root', () => {
    const noteId = testId<'sidebarItems'>('note_target')
    const ctx = createMonitorCtx()

    renderHook(() => useExternalDragMonitor({ current: ctx } as React.RefObject<DndMonitorCtx>))
    const monitor = getExternalMonitor()

    act(() => {
      monitor.onDragStart()
      monitor.onDropTargetChange({
        location: {
          current: {
            dropTargets: [{ data: { type: NOTE_EDITOR_DROP_TYPE, noteId } }],
          },
        },
      })
    })

    expect(useDndStore.getState().fileDragHoveredTargetKey).toBe(`note:${noteId}`)

    act(() => {
      monitor.onDropTargetChange({
        location: {
          current: {
            dropTargets: [{ data: { type: SIDEBAR_ROOT_DROP_TYPE } }],
          },
        },
      })
    })

    expect(useDndStore.getState().fileDragHoveredTargetKey).toBe(SIDEBAR_ROOT_DROP_TYPE)

    act(() => {
      monitor.onDropTargetChange({
        location: {
          current: {
            dropTargets: [],
          },
        },
      })
    })

    expect(useDndStore.getState().fileDragHoveredTargetKey).toBeNull()
  })

  it('routes external files dropped on registered targets to the target executor', async () => {
    const noteId = testId<'sidebarItems'>('note_target')
    const target = {
      type: NOTE_EDITOR_DROP_TYPE,
      noteId,
    }
    const file = new File(['content'], 'portrait.png', { type: 'image/png' })
    const dropResult: DropResult = {
      files: [{ file, relativePath: 'portrait.png' }],
      rootFolders: [],
    }
    processDataTransferItems.mockResolvedValue(dropResult)
    const execute = vi.fn(() => Promise.resolve({ handled: true }))
    const dispose = registerExternalFileDropExecutor({
      target,
      execute,
    })
    const ctx = createMonitorCtx()

    try {
      renderHook(() => useExternalDragMonitor({ current: ctx } as React.RefObject<DndMonitorCtx>))
      const monitor = getExternalMonitor()

      await act(async () => {
        await monitor.onDrop({
          source: { items: [] },
          location: {
            current: {
              input: { clientX: 12, clientY: 34 },
              dropTargets: [{ data: target }],
            },
          },
        })
      })

      expect(execute).toHaveBeenCalledWith(dropResult, { clientX: 12, clientY: 34 })
      expect(ctx.handleDropFiles).not.toHaveBeenCalled()
    } finally {
      dispose()
    }
  })

  it('uploads unhandled drop-result remainders returned by registered targets', async () => {
    const noteId = testId<'sidebarItems'>('note_target')
    const target = {
      type: NOTE_EDITOR_DROP_TYPE,
      noteId,
    }
    const dropResult: DropResult = {
      files: [],
      rootFolders: [{ name: 'Maps', relativePath: 'Maps', files: [], subfolders: [] }],
    }
    const unhandledDropResult: DropResult = {
      files: [],
      rootFolders: dropResult.rootFolders,
    }
    processDataTransferItems.mockResolvedValue(dropResult)
    const execute = vi.fn(() =>
      Promise.resolve({
        handled: true,
        unhandledDropResult,
      }),
    )
    const dispose = registerExternalFileDropExecutor({
      target,
      execute,
    })
    const ctx = createMonitorCtx()

    try {
      renderHook(() => useExternalDragMonitor({ current: ctx } as React.RefObject<DndMonitorCtx>))
      const monitor = getExternalMonitor()

      await act(async () => {
        await monitor.onDrop({
          source: { items: [] },
          location: {
            current: {
              input: { clientX: 12, clientY: 34 },
              dropTargets: [{ data: target }],
            },
          },
        })
      })

      expect(execute).toHaveBeenCalledWith(dropResult, { clientX: 12, clientY: 34 })
      expect(ctx.handleDropFiles).toHaveBeenCalledWith(unhandledDropResult, {
        destination: { kind: 'assets' },
      })
    } finally {
      dispose()
    }
  })

  it('falls back to uploading into sidebar item targets by sidebar item id', async () => {
    const folderId = testId<'sidebarItems'>('folder_target')
    const file = new File(['content'], 'portrait.png', { type: 'image/png' })
    const dropResult: DropResult = {
      files: [{ file, relativePath: 'portrait.png' }],
      rootFolders: [],
    }
    processDataTransferItems.mockResolvedValue(dropResult)
    const ctx = createMonitorCtx()

    renderHook(() => useExternalDragMonitor({ current: ctx } as React.RefObject<DndMonitorCtx>))
    const monitor = getExternalMonitor()

    await act(async () => {
      await monitor.onDrop({
        source: { items: [] },
        location: {
          current: {
            input: { clientX: 12, clientY: 34 },
            dropTargets: [
              {
                data: {
                  type: SIDEBAR_ITEM_TYPES.folders,
                  sidebarItemId: folderId,
                },
              },
            ],
          },
        },
      })
    })

    expect(ctx.handleDropFiles).toHaveBeenCalledWith(dropResult, {
      destination: { kind: 'direct', parentId: folderId },
    })
  })

  it('falls back to the assets-backed upload flow for non-sidebar external targets', async () => {
    const file = new File(['content'], 'portrait.png', { type: 'image/png' })
    const dropResult: DropResult = {
      files: [{ file, relativePath: 'portrait.png' }],
      rootFolders: [],
    }
    processDataTransferItems.mockResolvedValue(dropResult)
    const ctx = createMonitorCtx()

    renderHook(() => useExternalDragMonitor({ current: ctx } as React.RefObject<DndMonitorCtx>))
    const monitor = getExternalMonitor()

    await act(async () => {
      await monitor.onDrop({
        source: { items: [] },
        location: {
          current: {
            input: { clientX: 12, clientY: 34 },
            dropTargets: [{ data: { type: EMPTY_EDITOR_DROP_TYPE } }],
          },
        },
      })
    })

    expect(ctx.handleDropFiles).toHaveBeenCalledWith(dropResult, {
      destination: { kind: 'assets' },
    })
  })
})
