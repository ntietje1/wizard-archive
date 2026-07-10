import { act, renderHook } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { CanvasDocumentNode } from '../../document-contract'
import type { AnyItem } from '../../../workspace/items'
import { CANVAS_DROP_ZONE_TYPE } from '../../../drag-drop/drop-target-data'
import { executeRegisteredSurfaceDropCommand } from '../../../drag-drop/surface-command'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { useCanvasDropTarget } from '../use-drop-target'
import type { DropResult } from '../../../drag-drop/file-drop'
import { executePlannedDropCommand } from '../../../drag-drop/drop-command-execution'

type ExternalFileDropResult = DropResult

const uploadEmbedFile = vi.hoisted(() => vi.fn())
const dndCapability = vi.hoisted(() => ({
  canAcceptExternalFiles: true,
}))
const consoleError = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

vi.mock('../../../drag-drop/use-drop-target', () => ({
  useDndDropTarget: vi.fn(() => ({ dropTargetRef: vi.fn(), isDropTarget: false })),
}))

vi.mock('../../../drag-drop/use-external-drop-target', () => ({
  useExternalDropTarget: vi.fn(() => ({ externalDropTargetRef: vi.fn(), isFileDropTarget: false })),
}))

vi.mock('../../../drag-drop/context', () => ({
  useCanAcceptExternalFiles: () => dndCapability.canAcceptExternalFiles,
  useDndDropPayloadDispatcher: () => vi.fn(),
  useDndRuntimeDropData: <TData extends Record<string, unknown>>(data: TData) => data,
}))

function sidebarItemId(value: string) {
  return value as SidebarItemId
}

describe('useCanvasDropTarget', () => {
  beforeEach(() => {
    uploadEmbedFile.mockReset()
    dndCapability.canAcceptExternalFiles = true
    vi.mocked(toast.error).mockReset()
    consoleError.mockReset()
    vi.spyOn(console, 'error').mockImplementation(consoleError)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers a canvas-scoped surface file import executor', async () => {
    const canvasId = sidebarItemId('canvas_target')
    const uploadedId = sidebarItemId('uploaded_file')
    const createNodes = vi.fn()
    const patchNodeData = vi.fn()
    const flushUpdates = vi.fn(() => Promise.resolve())
    const file = new File(['content'], 'portrait.png', { type: 'image/png' })
    const dropResult: ExternalFileDropResult = {
      files: [{ file, relativePath: 'portrait.png' }],
      rootFolders: [{ name: 'Maps', relativePath: 'Maps', files: [], subfolders: [] }],
    }
    const upload = createDeferred<{ status: 'completed'; itemId: SidebarItemId }>()
    uploadEmbedFile.mockReturnValue(upload.promise)

    renderHook(() =>
      useCanvasDropTarget({
        canvasId,
        enabled: true,
        createNodes,
        patchNodeData,
        provider: { flushUpdates } as never,
        screenToCanvasPosition: ({ x, y }) => ({ x: x + 100, y: y + 200 }),
        uploadFile: uploadEmbedFile,
      }),
    )

    const execution = executePlannedDropCommand(
      {
        kind: 'surfaceFileImport',
        commandId: 'surface-file-import.canvas',
        target: { type: CANVAS_DROP_ZONE_TYPE, canvasId },
        dropResult,
        label: 'Upload to canvas',
      },
      { clientX: 10, clientY: 20 },
      {
        executeFileSystemCommand: vi.fn(),
        handleDropFiles: vi.fn(),
        openItem: vi.fn(),
        setBatchDecision: vi.fn(),
      },
    )

    expect(uploadEmbedFile).toHaveBeenCalledWith(file)
    expect(createNodes).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'embed',
        data: expect.objectContaining({
          target: { kind: 'empty' },
        }),
        position: { x: 110, y: 220 },
      }) satisfies Partial<CanvasDocumentNode>,
    ])
    expect(patchNodeData).not.toHaveBeenCalled()

    const pendingNode = (createNodes.mock.calls[0]![0] as Array<CanvasDocumentNode>)[0]
    upload.resolve({ status: 'completed', itemId: uploadedId })
    let outcome
    await act(async () => {
      outcome = await execution
    })

    expect(patchNodeData).toHaveBeenCalledWith(
      new Map([[pendingNode?.id, { target: { kind: 'resource', resourceId: uploadedId } }]]),
    )
    expect(flushUpdates).toHaveBeenCalledTimes(2)
    expect(outcome).toBeUndefined()
  })

  it('registers a canvas-scoped sidebar item embed executor', async () => {
    const canvasId = sidebarItemId('canvas_target')
    const droppedId = sidebarItemId('dropped_map')
    const createNodes = vi.fn()
    const flushUpdates = vi.fn(() => Promise.resolve())
    const effects = {
      reportError: vi.fn(),
      reportRejection: vi.fn(),
      reportRejections: vi.fn(),
    }
    const setBatchDecision = vi.fn()

    renderHook(() =>
      useCanvasDropTarget({
        canvasId,
        enabled: true,
        createNodes,
        patchNodeData: vi.fn(),
        provider: { flushUpdates } as never,
        screenToCanvasPosition: ({ x, y }) => ({ x: x + 100, y: y + 200 }),
      }),
    )

    let outcome
    await act(async () => {
      outcome = await executeRegisteredSurfaceDropCommand({
        command: {
          action: 'embed',
          commandId: 'surface-drop.embed-sidebar-item-in-canvas',
          items: [
            {
              campaignId: 'campaign-1',
              id: droppedId,
              name: 'Dropped Map',
              parentId: null,
              status: 'active',
              type: 'gameMaps',
            } as unknown as AnyItem,
          ],
          label: 'Embed item in canvas',
          rejectedItems: [],
          status: 'ready',
          target: { type: CANVAS_DROP_ZONE_TYPE, canvasId },
        },
        effects,
        input: { clientX: 10, clientY: 20 },
        setBatchDecision,
      })
    })

    expect(outcome).toBeUndefined()
    expect(createNodes).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'embed',
        data: expect.objectContaining({
          target: expect.objectContaining({ resourceId: droppedId }),
        }),
        position: { x: 110, y: 220 },
      }) satisfies Partial<CanvasDocumentNode>,
    ])
    expect(flushUpdates).toHaveBeenCalled()
    expect(setBatchDecision).not.toHaveBeenCalled()
  })

  it('registers a canvas-scoped external URL executor', async () => {
    const canvasId = sidebarItemId('canvas_target')
    const createNodes = vi.fn()
    const flushUpdates = vi.fn(() => Promise.resolve())

    renderHook(() =>
      useCanvasDropTarget({
        canvasId,
        enabled: true,
        createNodes,
        patchNodeData: vi.fn(),
        provider: { flushUpdates } as never,
        screenToCanvasPosition: ({ x, y }) => ({ x: x + 100, y: y + 200 }),
      }),
    )

    await act(async () => {
      await executePlannedDropCommand(
        {
          kind: 'surfaceExternalUrl',
          commandId: 'surface-url-drop.canvas',
          target: { type: CANVAS_DROP_ZONE_TYPE, canvasId },
          embedTarget: {
            kind: 'externalUrl',
            url: 'https://example.com/file.pdf',
            name: 'file.pdf',
          },
          label: 'Drop URL on canvas',
        },
        { clientX: 10, clientY: 20 },
        {
          executeFileSystemCommand: vi.fn(),
          handleDropFiles: vi.fn(),
          openItem: vi.fn(),
          setBatchDecision: vi.fn(),
        },
      )
    })

    expect(createNodes).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'embed',
        data: expect.objectContaining({
          target: {
            kind: 'externalUrl',
            url: 'https://example.com/file.pdf',
            name: 'file.pdf',
          },
        }),
        position: { x: 110, y: 220 },
      }) satisfies Partial<CanvasDocumentNode>,
    ])
    expect(flushUpdates).toHaveBeenCalled()
  })

  it('reports canvas upload failures without returning files to the generic upload flow', async () => {
    const canvasId = sidebarItemId('canvas_target')
    const createNodes = vi.fn()
    const patchNodeData = vi.fn()
    const flushUpdates = vi.fn(() => Promise.resolve())
    const file = new File(['content'], 'portrait.png', { type: 'image/png' })
    const error = new Error('upload failed')
    const dropResult: ExternalFileDropResult = {
      files: [{ file, relativePath: 'portrait.png' }],
      rootFolders: [],
    }
    uploadEmbedFile.mockRejectedValue(error)

    renderHook(() =>
      useCanvasDropTarget({
        canvasId,
        enabled: true,
        createNodes,
        patchNodeData,
        provider: { flushUpdates } as never,
        screenToCanvasPosition: ({ x, y }) => ({ x, y }),
        uploadFile: uploadEmbedFile,
      }),
    )

    let outcome
    await act(async () => {
      outcome = await executePlannedDropCommand(
        {
          kind: 'surfaceFileImport',
          commandId: 'surface-file-import.canvas',
          target: { type: CANVAS_DROP_ZONE_TYPE, canvasId },
          dropResult,
          label: 'Upload to canvas',
        },
        { clientX: 10, clientY: 20 },
        {
          executeFileSystemCommand: vi.fn(),
          handleDropFiles: vi.fn(),
          openItem: vi.fn(),
          setBatchDecision: vi.fn(),
        },
      )
    })

    expect(uploadEmbedFile).toHaveBeenCalledWith(file)
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('Failed to upload file to canvas')
    expect(consoleError).toHaveBeenCalledWith(error)
    expect(createNodes).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'embed',
        data: expect.objectContaining({ target: { kind: 'empty' } }),
      }),
    ])
    expect(patchNodeData).not.toHaveBeenCalled()
    expect(flushUpdates).toHaveBeenCalledOnce()
    expect(outcome).toBeUndefined()
  })

  it('does not register external file uploads when the runtime does not accept files', async () => {
    dndCapability.canAcceptExternalFiles = false
    const canvasId = sidebarItemId('canvas_target')
    const createNodes = vi.fn()
    const file = new File(['content'], 'portrait.png', { type: 'image/png' })
    const dropResult: ExternalFileDropResult = {
      files: [{ file, relativePath: 'portrait.png' }],
      rootFolders: [],
    }

    renderHook(() =>
      useCanvasDropTarget({
        canvasId,
        enabled: true,
        createNodes,
        patchNodeData: vi.fn(),
        provider: { flushUpdates: vi.fn() } as never,
        screenToCanvasPosition: ({ x, y }) => ({ x, y }),
        uploadFile: uploadEmbedFile,
      }),
    )

    await act(async () => {
      await expect(
        executePlannedDropCommand(
          {
            kind: 'surfaceFileImport',
            commandId: 'surface-file-import.canvas',
            target: { type: CANVAS_DROP_ZONE_TYPE, canvasId },
            dropResult,
            label: 'Upload to canvas',
          },
          { clientX: 10, clientY: 20 },
          {
            executeFileSystemCommand: vi.fn(),
            handleDropFiles: vi.fn(),
            openItem: vi.fn(),
            setBatchDecision: vi.fn(),
          },
        ),
      ).rejects.toThrow('Missing surface file import executor')
    })

    expect(uploadEmbedFile).not.toHaveBeenCalled()
    expect(createNodes).not.toHaveBeenCalled()
  })

  it('does not register external file uploads without an upload capability', async () => {
    const canvasId = sidebarItemId('canvas_target')
    const createNodes = vi.fn()
    const file = new File(['content'], 'portrait.png', { type: 'image/png' })
    const dropResult: ExternalFileDropResult = {
      files: [{ file, relativePath: 'portrait.png' }],
      rootFolders: [],
    }

    renderHook(() =>
      useCanvasDropTarget({
        canvasId,
        enabled: true,
        createNodes,
        patchNodeData: vi.fn(),
        provider: { flushUpdates: vi.fn() } as never,
        screenToCanvasPosition: ({ x, y }) => ({ x, y }),
      }),
    )

    await act(async () => {
      await expect(
        executePlannedDropCommand(
          {
            kind: 'surfaceFileImport',
            commandId: 'surface-file-import.canvas',
            target: { type: CANVAS_DROP_ZONE_TYPE, canvasId },
            dropResult,
            label: 'Upload to canvas',
          },
          { clientX: 10, clientY: 20 },
          {
            executeFileSystemCommand: vi.fn(),
            handleDropFiles: vi.fn(),
            openItem: vi.fn(),
            setBatchDecision: vi.fn(),
          },
        ),
      ).rejects.toThrow('Missing surface file import executor')
    })

    expect(uploadEmbedFile).not.toHaveBeenCalled()
    expect(createNodes).not.toHaveBeenCalled()
  })
})

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })
  return { promise, resolve }
}
