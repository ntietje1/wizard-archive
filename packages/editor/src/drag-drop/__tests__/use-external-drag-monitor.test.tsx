import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { DropResult } from '../file-drop'
import {
  CANVAS_DROP_ZONE_TYPE,
  EMPTY_EDITOR_DROP_TYPE,
  NOTE_EDITOR_DROP_TYPE,
  SIDEBAR_ROOT_DROP_TYPE,
} from '../drop-target-data'
import { registerSurfaceFileImportExecutor } from '../drop-command-execution'
import { defaultDndStoreApi as useDndStore } from '../store'
import { resetDndStore } from './store-test-utils'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { AnyItem } from '../../workspace/items'
import { testId } from '../../test/id'
import { useExternalDragMonitor } from '../use-external-drag-monitor'
import { createResourceCatalogModel } from '../../filesystem/catalog'
import { createFolder as createFolderFixture } from '../../test/sidebar-item-factory'

const monitorForExternal = vi.hoisted(() => vi.fn())
const processDataTransferItems = vi.hoisted(() => vi.fn())
const handleError = vi.hoisted(() => vi.fn())

vi.mock('@atlaskit/pragmatic-drag-and-drop/external/adapter', () => ({
  monitorForExternal: (args: unknown) => monitorForExternal(args),
}))

vi.mock('@atlaskit/pragmatic-drag-and-drop/external/file', () => ({
  containsFiles: () => true,
}))

vi.mock('../file-drop', () => ({
  processDataTransferItems,
}))

vi.mock('../../errors/handle-error', () => ({
  handleError,
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
type ExternalDragMonitorContext =
  Parameters<typeof useExternalDragMonitor>[0] extends React.RefObject<infer T> ? T : never

function createMonitorCtx(items: Array<AnyItem> = []): ExternalDragMonitorContext {
  const { catalog } = createResourceCatalogModel({
    activeItems: items,
    trashItems: [],
  })
  return {
    catalog,
    dndContext: {
      executeFileSystemCommand: vi.fn(),
      openItem: vi.fn(),
    },
    dropPlanningContext: {
      workspaceId: null,
      workspaceName: 'Test Campaign',
      canCreateRootItems: true,
      canManageFolders: true,
    },
    handleDropFiles: vi.fn(),
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
    handleError.mockReset()
    resetDndStore()
  })

  it('tracks the top external file drop target without treating note editors as sidebar root', () => {
    const noteId = testId<'sidebarItems'>('note_target')
    const ctx = createMonitorCtx()

    renderHook(() =>
      useExternalDragMonitor({ current: ctx } as React.RefObject<ExternalDragMonitorContext>),
    )
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

    expect(useDndStore.getState().externalFileDropTargetKey).toBe(`note:${noteId}`)

    act(() => {
      monitor.onDropTargetChange({
        location: {
          current: {
            dropTargets: [{ data: { type: SIDEBAR_ROOT_DROP_TYPE } }],
          },
        },
      })
    })

    expect(useDndStore.getState().externalFileDropTargetKey).toBe(SIDEBAR_ROOT_DROP_TYPE)

    act(() => {
      monitor.onDropTargetChange({
        location: {
          current: {
            dropTargets: [],
          },
        },
      })
    })

    expect(useDndStore.getState().externalFileDropTargetKey).toBeNull()
  })

  it('clears external file drag state when the monitor disables mid-drag', () => {
    const cleanup = vi.fn()
    monitorForExternal.mockReturnValue(cleanup)
    const noteId = testId<'sidebarItems'>('note_target')
    const ctx = createMonitorCtx()

    const { rerender } = renderHook(
      ({ enabled }) =>
        useExternalDragMonitor({ current: ctx } as React.RefObject<ExternalDragMonitorContext>, {
          enabled,
        }),
      { initialProps: { enabled: true } },
    )
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

    expect(useDndStore.getState().isDraggingFiles).toBe(true)
    expect(useDndStore.getState().externalFileDropTargetKey).toBe(`note:${noteId}`)

    act(() => {
      rerender({ enabled: false })
    })

    expect(cleanup).toHaveBeenCalledOnce()
    expect(useDndStore.getState().isDraggingFiles).toBe(false)
    expect(useDndStore.getState().externalFileDropTargetKey).toBeNull()
  })

  it('clears the hovered external file target when the active target belongs to another runtime', () => {
    const noteId = testId<'sidebarItems'>('note_target')
    const ctx = {
      ...createMonitorCtx(),
      runtimeId: 'runtime-b',
    }

    renderHook(() =>
      useExternalDragMonitor({ current: ctx } as React.RefObject<ExternalDragMonitorContext>),
    )
    const monitor = getExternalMonitor()

    act(() => {
      monitor.onDragStart()
      monitor.onDropTargetChange({
        location: {
          current: {
            dropTargets: [
              {
                data: {
                  type: NOTE_EDITOR_DROP_TYPE,
                  noteId,
                  __wizardArchiveDndRuntimeId: 'runtime-b',
                },
              },
            ],
          },
        },
      })
    })

    expect(useDndStore.getState().externalFileDropTargetKey).toBe(
      `runtime:runtime-b:note:${noteId}`,
    )

    act(() => {
      monitor.onDropTargetChange({
        location: {
          current: {
            dropTargets: [
              {
                data: {
                  type: NOTE_EDITOR_DROP_TYPE,
                  noteId,
                  __wizardArchiveDndRuntimeId: 'runtime-a',
                },
              },
            ],
          },
        },
      })
    })

    expect(useDndStore.getState().externalFileDropTargetKey).toBeNull()
  })

  it('routes external files dropped on registered targets to the target executor', async () => {
    const canvasId = testId<'sidebarItems'>('canvas_target')
    const target = {
      type: CANVAS_DROP_ZONE_TYPE,
      canvasId,
    }
    const file = new File(['content'], 'portrait.png', { type: 'image/png' })
    const dropResult: DropResult = {
      files: [{ file, relativePath: 'portrait.png' }],
      rootFolders: [],
    }
    processDataTransferItems.mockResolvedValue(dropResult)
    const execute = vi.fn(() => Promise.resolve({ uploadedCount: 1 }))
    const dispose = registerSurfaceFileImportExecutor({
      commandId: 'surface-file-import.canvas',
      target,
      execute,
    })
    const ctx = createMonitorCtx()

    try {
      renderHook(() =>
        useExternalDragMonitor({ current: ctx } as React.RefObject<ExternalDragMonitorContext>),
      )
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

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'surfaceFileImport',
          commandId: 'surface-file-import.canvas',
          dropResult,
          target,
        }),
        { clientX: 12, clientY: 34 },
      )
      expect(ctx.handleDropFiles).not.toHaveBeenCalled()
    } finally {
      dispose()
    }
  })

  it('imports mixed canvas file and folder drops through an explicit command sequence', async () => {
    const canvasId = testId<'sidebarItems'>('canvas_target')
    const target = {
      type: CANVAS_DROP_ZONE_TYPE,
      canvasId,
    }
    const dropResult: DropResult = {
      files: [{ file: new File(['content'], 'portrait.png'), relativePath: 'portrait.png' }],
      rootFolders: [{ name: 'Maps', relativePath: 'Maps', files: [], subfolders: [] }],
    }
    processDataTransferItems.mockResolvedValue(dropResult)
    const execute = vi.fn(() => Promise.resolve({ uploadedCount: 1 }))
    const dispose = registerSurfaceFileImportExecutor({
      commandId: 'surface-file-import.canvas',
      target,
      execute,
    })
    const ctx = createMonitorCtx()
    ;(ctx.handleDropFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 'completed',
      receipt: { imported: 1 },
    })

    try {
      renderHook(() =>
        useExternalDragMonitor({ current: ctx } as React.RefObject<ExternalDragMonitorContext>),
      )
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

      expect(execute).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'surfaceFileImport',
          dropResult: { files: dropResult.files, rootFolders: [] },
        }),
        { clientX: 12, clientY: 34 },
      )
      expect(ctx.handleDropFiles).toHaveBeenCalledWith(
        { files: [], rootFolders: dropResult.rootFolders },
        {
          destination: { kind: 'assets' },
        },
      )
    } finally {
      dispose()
    }
  })

  it('reports registered target executor failures without retrying the generic upload flow', async () => {
    const canvasId = testId<'sidebarItems'>('canvas_target')
    const target = {
      type: CANVAS_DROP_ZONE_TYPE,
      canvasId,
    }
    const file = new File(['content'], 'portrait.png', { type: 'image/png' })
    const dropResult: DropResult = {
      files: [{ file, relativePath: 'portrait.png' }],
      rootFolders: [],
    }
    processDataTransferItems.mockResolvedValue(dropResult)
    const execute = vi.fn(() => Promise.reject(new Error('target failed')))
    const dispose = registerSurfaceFileImportExecutor({
      commandId: 'surface-file-import.canvas',
      target,
      execute,
    })
    const ctx = createMonitorCtx()

    try {
      renderHook(() =>
        useExternalDragMonitor({ current: ctx } as React.RefObject<ExternalDragMonitorContext>),
      )
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

      expect(execute).toHaveBeenCalledWith(expect.any(Object), { clientX: 12, clientY: 34 })
      expect(ctx.handleDropFiles).not.toHaveBeenCalled()
      expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'Failed to upload files')
    } finally {
      dispose()
    }
  })

  it('falls back to uploading into sidebar item targets by sidebar item id', async () => {
    const folder = createFolderFixture({ id: testId<'sidebarItems'>('folder_target') })
    const file = new File(['content'], 'portrait.png', { type: 'image/png' })
    const dropResult: DropResult = {
      files: [{ file, relativePath: 'portrait.png' }],
      rootFolders: [],
    }
    processDataTransferItems.mockResolvedValue(dropResult)
    const ctx = createMonitorCtx([folder])

    renderHook(() =>
      useExternalDragMonitor({ current: ctx } as React.RefObject<ExternalDragMonitorContext>),
    )
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
                  type: RESOURCE_TYPES.folders,
                  sidebarItemId: folder.id,
                },
              },
            ],
          },
        },
      })
    })

    expect(ctx.handleDropFiles).toHaveBeenCalledWith(dropResult, {
      destination: { kind: 'direct', parentId: folder.id },
    })
  })

  it('ignores external drops on targets owned by another runtime', async () => {
    const folderId = testId<'sidebarItems'>('folder_target')
    const file = new File(['content'], 'portrait.png', { type: 'image/png' })
    const dropResult: DropResult = {
      files: [{ file, relativePath: 'portrait.png' }],
      rootFolders: [],
    }
    processDataTransferItems.mockResolvedValue(dropResult)
    const ctx = {
      ...createMonitorCtx(),
      runtimeId: 'runtime-b',
    }

    renderHook(() =>
      useExternalDragMonitor({ current: ctx } as React.RefObject<ExternalDragMonitorContext>),
    )
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
                  type: RESOURCE_TYPES.folders,
                  sidebarItemId: folderId,
                  __wizardArchiveDndRuntimeId: 'runtime-a',
                },
              },
            ],
          },
        },
      })
    })

    expect(processDataTransferItems).not.toHaveBeenCalled()
    expect(ctx.handleDropFiles).not.toHaveBeenCalled()
  })

  it('uploads external files at the workspace root when no drop target is active', async () => {
    const file = new File(['content'], 'portrait.png', { type: 'image/png' })
    const dropResult: DropResult = {
      files: [{ file, relativePath: 'portrait.png' }],
      rootFolders: [],
    }
    processDataTransferItems.mockResolvedValue(dropResult)
    const ctx = createMonitorCtx()

    renderHook(() =>
      useExternalDragMonitor({ current: ctx } as React.RefObject<ExternalDragMonitorContext>),
    )
    const monitor = getExternalMonitor()

    await act(async () => {
      await monitor.onDrop({
        source: { items: [] },
        location: {
          current: {
            input: { clientX: 12, clientY: 34 },
            dropTargets: [],
          },
        },
      })
    })

    expect(ctx.handleDropFiles).toHaveBeenCalledWith(dropResult, {
      destination: { kind: 'direct', parentId: null },
    })
  })

  it('uploads external files at the workspace root when the sidebar root target is active', async () => {
    const file = new File(['content'], 'portrait.png', { type: 'image/png' })
    const dropResult: DropResult = {
      files: [{ file, relativePath: 'portrait.png' }],
      rootFolders: [],
    }
    processDataTransferItems.mockResolvedValue(dropResult)
    const ctx = createMonitorCtx()

    renderHook(() =>
      useExternalDragMonitor({ current: ctx } as React.RefObject<ExternalDragMonitorContext>),
    )
    const monitor = getExternalMonitor()

    await act(async () => {
      await monitor.onDrop({
        source: { items: [] },
        location: {
          current: {
            input: { clientX: 12, clientY: 34 },
            dropTargets: [{ data: { type: SIDEBAR_ROOT_DROP_TYPE } }],
          },
        },
      })
    })

    expect(ctx.handleDropFiles).toHaveBeenCalledWith(dropResult, {
      destination: { kind: 'direct', parentId: null },
    })
  })

  it('does not let a registered canvas executor intercept external drops for non-canvas targets', async () => {
    const canvasId = testId<'sidebarItems'>('canvas_target')
    const folderId = testId<'sidebarItems'>('folder_target')
    const dropResult: DropResult = {
      files: [],
      rootFolders: [{ name: 'Maps', relativePath: 'Maps', files: [], subfolders: [] }],
    }
    processDataTransferItems.mockResolvedValue(dropResult)
    const execute = vi.fn(() => Promise.resolve({ uploadedCount: 1 }))
    const dispose = registerSurfaceFileImportExecutor({
      commandId: 'surface-file-import.canvas',
      target: { type: CANVAS_DROP_ZONE_TYPE, canvasId },
      execute,
    })
    const folder = createFolderFixture({ id: folderId })
    const ctx = createMonitorCtx([folder])

    try {
      renderHook(() =>
        useExternalDragMonitor({ current: ctx } as React.RefObject<ExternalDragMonitorContext>),
      )
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
                    type: RESOURCE_TYPES.folders,
                    sidebarItemId: folderId,
                  },
                },
              ],
            },
          },
        })
      })

      expect(execute).not.toHaveBeenCalled()
      expect(ctx.handleDropFiles).toHaveBeenCalledWith(dropResult, {
        destination: { kind: 'direct', parentId: folderId },
      })
    } finally {
      dispose()
    }
  })

  it('falls back to the assets-backed upload flow for non-sidebar external targets', async () => {
    const file = new File(['content'], 'portrait.png', { type: 'image/png' })
    const dropResult: DropResult = {
      files: [{ file, relativePath: 'portrait.png' }],
      rootFolders: [],
    }
    processDataTransferItems.mockResolvedValue(dropResult)
    const ctx = createMonitorCtx()

    renderHook(() =>
      useExternalDragMonitor({ current: ctx } as React.RefObject<ExternalDragMonitorContext>),
    )
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
