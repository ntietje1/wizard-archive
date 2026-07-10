import { act, render, screen, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { useEmbedDropTarget } from '../use-drop-target'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import type { EmbedTarget } from '../../../../../../shared/embeds/embedTargets'
import type { EmbedTargetUploadFileResult } from '../../target-operations'
import { EMPTY_EMBED_DROP_TYPE } from '../../../drag-drop/drop-target-data'
import { executeRegisteredSurfaceDropCommand } from '../../../drag-drop/surface-command'
import { executePlannedDropCommand } from '../../../drag-drop/drop-command-execution'
import { DndProviderContext } from '../../../drag-drop/context'
import { useExternalDropTarget } from '../../../drag-drop/use-external-drop-target'
import { useExternalUrlDropTarget } from '../../../drag-drop/use-external-url-drop-target'
import { createNote as createNoteFixture } from '../../../test/sidebar-item-factory'
import { testId } from '../../../test/id'

const dropTargetState = vi.hoisted(() => ({
  args: null as null | {
    element: HTMLElement
    getData?: () => Record<string, unknown>
    canDrop: (input: { source: { data: Record<string | symbol, unknown> } }) => boolean
    onDragEnter: (input: { source: { data: Record<string | symbol, unknown> } }) => void
    onDragLeave: () => void
    onDrop: (input: { source: { data: Record<string | symbol, unknown> } }) => void
  },
}))
vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  dropTargetForElements: vi.fn((args) => {
    dropTargetState.args = args
    return vi.fn()
  }),
}))
vi.mock('../../../drag-drop/use-external-drop-target', () => ({
  useExternalDropTarget: vi.fn(() => ({
    externalDropTargetRef: vi.fn(),
    isFileDropTarget: false,
  })),
}))
vi.mock('../../../drag-drop/use-external-url-drop-target', async (importOriginal) => {
  const actual = (await importOriginal()) as {
    useExternalUrlDropTarget: typeof useExternalUrlDropTarget
  }
  return {
    useExternalUrlDropTarget: vi.fn(actual.useExternalUrlDropTarget),
  }
})
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

const campaignId = testId<'campaigns'>('campaign_1')
type TestDropPayloadDispatcher = (input: {
  payload: unknown
  rawTarget: Record<string, unknown> | null
  dropInput: unknown
}) => Promise<void>

describe('useEmbedDropTarget', () => {
  beforeEach(() => {
    dropTargetState.args = null
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('registers empty embed replacements for central surface execution', async () => {
    const droppedNote = createNote({ id: sidebarItemId('note-1') })
    const setTarget = vi.fn(() => Promise.resolve())
    const { unmount } = renderHookHarness({ sourceItemId: sidebarItemId('canvas-1'), setTarget })

    await waitFor(() => expect(dropTargetState.args).not.toBeNull())

    expect(
      dropTargetState.args!.canDrop({
        source: { data: sidebarDragData(sidebarItemId('canvas-1')) },
      }),
    ).toBe(false)
    expect(
      dropTargetState.args!.canDrop({
        source: { data: sidebarDragData(sidebarItemId('note-1')) },
      }),
    ).toBe(true)
    expect(dropTargetState.args!.getData?.()).toEqual({
      type: EMPTY_EMBED_DROP_TYPE,
      sourceItemId: sidebarItemId('canvas-1'),
      embedBlockId: 'embed-block-1',
    })

    await executeRegisteredSurfaceDropCommand({
      command: {
        status: 'ready',
        commandId: 'surface-drop.embed-sidebar-item-in-note',
        action: 'noteEmbed',
        items: [droppedNote],
        rejectedItems: [],
        target: {
          type: EMPTY_EMBED_DROP_TYPE,
          sourceItemId: sidebarItemId('canvas-1'),
          embedBlockId: 'embed-block-1',
        },
        label: 'Embed item here',
      },
      input: { clientX: 0, clientY: 0 },
      setBatchDecision: vi.fn(),
    })

    await waitFor(() =>
      expect(setTarget).toHaveBeenCalledWith({
        kind: 'resource',
        resourceId: sidebarItemId('note-1'),
      }),
    )

    unmount()
  })

  it('keeps empty embed executors scoped to each embed block in the same note', async () => {
    const firstDroppedNote = createNote({ id: sidebarItemId('note-1') })
    const secondDroppedNote = createNote({ id: sidebarItemId('note-2') })
    const firstSetTarget = vi.fn(() => Promise.resolve())
    const secondSetTarget = vi.fn(() => Promise.resolve())

    render(
      <>
        <CanvasEmbedDropTargetHarness
          embedBlockId="embed-block-1"
          sourceItemId={sidebarItemId('canvas-1')}
          setTarget={firstSetTarget}
          elementTestId="first-drop-target"
          uploadFile={vi.fn()}
        />
        <CanvasEmbedDropTargetHarness
          embedBlockId="embed-block-2"
          sourceItemId={sidebarItemId('canvas-1')}
          setTarget={secondSetTarget}
          elementTestId="second-drop-target"
          uploadFile={vi.fn()}
        />
      </>,
    )

    await executeRegisteredSurfaceDropCommand({
      command: {
        status: 'ready',
        commandId: 'surface-drop.embed-sidebar-item-in-note',
        action: 'noteEmbed',
        items: [firstDroppedNote],
        rejectedItems: [],
        target: {
          type: EMPTY_EMBED_DROP_TYPE,
          sourceItemId: sidebarItemId('canvas-1'),
          embedBlockId: 'embed-block-1',
        },
        label: 'Embed item here',
      },
      input: { clientX: 0, clientY: 0 },
      setBatchDecision: vi.fn(),
    })
    await executeRegisteredSurfaceDropCommand({
      command: {
        status: 'ready',
        commandId: 'surface-drop.embed-sidebar-item-in-note',
        action: 'noteEmbed',
        items: [secondDroppedNote],
        rejectedItems: [],
        target: {
          type: EMPTY_EMBED_DROP_TYPE,
          sourceItemId: sidebarItemId('canvas-1'),
          embedBlockId: 'embed-block-2',
        },
        label: 'Embed item here',
      },
      input: { clientX: 0, clientY: 0 },
      setBatchDecision: vi.fn(),
    })

    await waitFor(() =>
      expect(firstSetTarget).toHaveBeenCalledWith({
        kind: 'resource',
        resourceId: sidebarItemId('note-1'),
      }),
    )
    expect(secondSetTarget).toHaveBeenCalledWith({
      kind: 'resource',
      resourceId: sidebarItemId('note-2'),
    })
    expect(firstSetTarget).toHaveBeenCalledTimes(1)
    expect(secondSetTarget).toHaveBeenCalledTimes(1)
  })

  it('rejects surface execution with more than one dropped item', async () => {
    const droppedNote = createNote({ id: sidebarItemId('note-1') })
    const secondDroppedNote = createNote({ id: sidebarItemId('note-2') })
    const setTarget = vi.fn(() => Promise.resolve())
    renderHookHarness({ sourceItemId: sidebarItemId('canvas-1'), setTarget })

    await waitFor(() => expect(dropTargetState.args).not.toBeNull())

    await expect(
      executeRegisteredSurfaceDropCommand({
        command: {
          status: 'ready',
          commandId: 'surface-drop.embed-sidebar-item-in-note',
          action: 'noteEmbed',
          items: [droppedNote, secondDroppedNote],
          rejectedItems: [],
          target: {
            type: EMPTY_EMBED_DROP_TYPE,
            sourceItemId: sidebarItemId('canvas-1'),
            embedBlockId: 'embed-block-1',
          },
          label: 'Embed item here',
        },
        input: { clientX: 0, clientY: 0 },
        effects: {
          reportError: (_error, fallbackMessage) => toast.error(fallbackMessage),
          reportRejection: vi.fn(),
          reportRejections: vi.fn(),
        },
        setBatchDecision: vi.fn(),
      }),
    ).resolves.toBeUndefined()
    expect(setTarget).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Failed to add embeds')
  })

  it('ignores editor block drag data that only contains embed block props', async () => {
    renderHookHarness()

    await waitFor(() => expect(dropTargetState.args).not.toBeNull())

    const blockDragData = {
      targetKind: 'resource',
      resourceId: sidebarItemId('note-1'),
    }

    expect(dropTargetState.args!.canDrop({ source: { data: blockDragData } })).toBe(false)
  })

  it('rejects sidebar item drops when the extracted item is not in the drag id set', async () => {
    const setTarget = vi.fn(() => Promise.resolve())
    renderHookHarness({ setTarget })

    await waitFor(() => expect(dropTargetState.args).not.toBeNull())

    const forgedDragData = {
      sidebarItemId: sidebarItemId('note-1'),
      sidebarItemIds: [sidebarItemId('note-2')],
    }

    expect(dropTargetState.args!.canDrop({ source: { data: forgedDragData } })).toBe(false)
  })

  it('rejects multi-item sidebar drops because one empty embed has one target slot', async () => {
    const setTarget = vi.fn(() => Promise.resolve())
    renderHookHarness({ sourceItemId: sidebarItemId('canvas-1'), setTarget })

    await waitFor(() => expect(dropTargetState.args).not.toBeNull())

    const multiItemDragData = {
      sidebarItemId: sidebarItemId('note-1'),
      sidebarItemIds: [sidebarItemId('note-1'), sidebarItemId('note-2')],
    }

    expect(dropTargetState.args!.canDrop({ source: { data: multiItemDragData } })).toBe(false)
  })

  it('reports valid sidebar item drops as active shared drop target feedback', async () => {
    renderHookHarness({ sourceItemId: sidebarItemId('canvas-1') })

    await waitFor(() => expect(dropTargetState.args).not.toBeNull())

    act(() => {
      dropTargetState.args!.onDragEnter({
        source: { data: sidebarDragData(sidebarItemId('note-1')) },
      })
    })

    expect(screen.getByTestId('drop-target')).toHaveAttribute('data-drop-target', 'true')
    expect(screen.getByTestId('drop-target')).toHaveAttribute('data-file-drop-target', 'false')

    act(() => {
      dropTargetState.args!.onDragLeave()
    })

    expect(screen.getByTestId('drop-target')).toHaveAttribute('data-drop-target', 'false')
  })

  it('does not report rejected sidebar item drops as active feedback', async () => {
    renderHookHarness({ sourceItemId: sidebarItemId('canvas-1') })

    await waitFor(() => expect(dropTargetState.args).not.toBeNull())

    act(() => {
      dropTargetState.args!.onDragEnter({
        source: { data: sidebarDragData(sidebarItemId('canvas-1')) },
      })
    })

    expect(screen.getByTestId('drop-target')).toHaveAttribute('data-drop-target', 'false')
  })

  it('dispatches external URL drops through the runtime command pipeline', async () => {
    const setTarget = vi.fn(() => Promise.resolve())
    const dispatchDropPayload = vi.fn(() => Promise.resolve())
    renderHookHarness({ setTarget, dispatchDropPayload })

    dispatchNativeDrop({
      types: ['text/plain'],
      getData: (type) => (type === 'text/plain' ? 'https://example.com/file.pdf' : ''),
    })

    await waitFor(() =>
      expect(dispatchDropPayload).toHaveBeenCalledWith({
        payload: {
          kind: 'externalUrl',
          target: {
            kind: 'externalUrl',
            url: 'https://example.com/file.pdf',
            name: 'file.pdf',
          },
        },
        rawTarget: expect.objectContaining({
          type: EMPTY_EMBED_DROP_TYPE,
          sourceItemId: sidebarItemId('canvas-1'),
          embedBlockId: 'embed-block-1',
        }),
        dropInput: { clientX: 0, clientY: 0 },
      }),
    )
    expect(setTarget).not.toHaveBeenCalled()
  })

  it('protects external URL dragover without consuming the dropped URL data', () => {
    const getData = vi.fn(() => 'https://example.com/file.pdf')
    renderHookHarness()

    const { event, dataTransfer } = dispatchNativeDragEvent('dragover', {
      types: ['text/plain'],
      getData,
    })

    expect(event.defaultPrevented).toBe(true)
    expect(dataTransfer.dropEffect).toBe('copy')
    expect(getData).not.toHaveBeenCalled()
  })

  it('consumes invalid external text drops as explicit rejections', () => {
    const setTarget = vi.fn(() => Promise.resolve())
    renderHookHarness({ setTarget })

    const { event } = dispatchNativeDrop({
      types: ['text/plain'],
      getData: (type) => (type === 'text/plain' ? 'not a url' : ''),
    })

    expect(event.defaultPrevented).toBe(true)
    expect(setTarget).not.toHaveBeenCalled()
  })

  it('leaves native file drops to the shared external file monitor', () => {
    const setTarget = vi.fn(() => Promise.resolve())
    renderHookHarness({ setTarget, uploadFile: vi.fn() })

    const { event } = dispatchNativeDrop({
      types: ['Files'],
      files: { item: () => null },
      getData: () => '',
    })

    expect(event.defaultPrevented).toBe(false)
    expect(screen.getByTestId('drop-target')).toHaveAttribute('data-drop-target', 'false')
    expect(setTarget).not.toHaveBeenCalled()
  })

  it('ignores app-internal native URL drops', () => {
    const setTarget = vi.fn(() => Promise.resolve())
    renderHookHarness({ setTarget })

    const { event, dataTransfer } = dispatchNativeDrop({
      types: ['application/x-wizard-archive-internal-drag', 'text/plain'],
      getData: (type) =>
        type === 'text/plain'
          ? 'https://example.com/internal-image.png'
          : type === 'application/x-wizard-archive-internal-drag'
            ? 'true'
            : '',
    })

    expect(event.defaultPrevented).toBe(false)
    expect(dataTransfer.dropEffect).toBeUndefined()
  })

  it('dispatches uri-list URL drops with comments through the runtime command pipeline', async () => {
    const setTarget = vi.fn(() => Promise.resolve())
    const dispatchDropPayload = vi.fn(() => Promise.resolve())
    renderHookHarness({ setTarget, dispatchDropPayload })

    dispatchNativeDrop({
      types: ['text/uri-list', 'text/plain'],
      getData: (type) =>
        type === 'text/uri-list'
          ? '# SourceURL: https://ignored.example\nhttps://example.com/file.pdf'
          : 'https://fallback.example/fallback.pdf',
    })

    await waitFor(() =>
      expect(dispatchDropPayload).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: {
            kind: 'externalUrl',
            target: {
              kind: 'externalUrl',
              url: 'https://example.com/file.pdf',
              name: 'file.pdf',
            },
          },
        }),
      ),
    )
    expect(setTarget).not.toHaveBeenCalled()
  })

  it('registers empty embed external URL execution through the drop pipeline', async () => {
    const setTarget = vi.fn(() => Promise.resolve())
    renderHookHarness({ setTarget })

    await executePlannedDropCommand(
      {
        kind: 'surfaceExternalUrl',
        commandId: 'surface-url-drop.empty-embed',
        target: {
          type: EMPTY_EMBED_DROP_TYPE,
          sourceItemId: sidebarItemId('canvas-1'),
          embedBlockId: 'embed-block-1',
        },
        embedTarget: {
          kind: 'externalUrl',
          url: 'https://example.com/file.pdf',
          name: 'file.pdf',
        },
        label: 'Drop URL on embed',
      },
      { clientX: 0, clientY: 0 },
      {
        executeFileSystemCommand: vi.fn(),
        handleDropFiles: vi.fn(),
        openItem: vi.fn(),
        setBatchDecision: vi.fn(),
      },
    )

    await waitFor(() =>
      expect(setTarget).toHaveBeenCalledWith({
        kind: 'externalUrl',
        url: 'https://example.com/file.pdf',
        name: 'file.pdf',
      }),
    )
  })

  it('uploads shared external file commands before replacing the embed target', async () => {
    const setTarget = vi.fn(() => Promise.resolve())
    const uploadFile = vi.fn(() =>
      Promise.resolve({ status: 'completed' as const, itemId: sidebarItemId('file-1') }),
    )
    const file = new File(['x'], 'image.png', { type: 'image/png' })
    renderHookHarness({ setTarget, uploadFile })

    await executeEmptyEmbedFileImport(file)

    expect(uploadFile).toHaveBeenCalledWith(file)
    expect(setTarget).toHaveBeenCalledWith({
      kind: 'resource',
      resourceId: sidebarItemId('file-1'),
    })
  })

  it('reports shared external file drop feedback for empty embed file drags', () => {
    vi.mocked(useExternalDropTarget).mockReturnValue({
      externalDropTargetRef: vi.fn(),
      isFileDropTarget: true,
    })

    renderHookHarness()

    expect(screen.getByTestId('drop-target')).toHaveAttribute('data-drop-target', 'true')
    expect(screen.getByTestId('drop-target')).toHaveAttribute('data-file-drop-target', 'true')
  })

  it('disables external file drop targeting for non-empty embeds', () => {
    renderHookHarness({
      target: {
        kind: 'externalUrl',
        url: 'https://example.com/file.pdf',
        name: 'file.pdf',
      },
    })

    expect(useExternalDropTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    )
  })

  it('disables external URL drop targeting for non-empty embeds', () => {
    renderHookHarness({
      target: {
        kind: 'externalUrl',
        url: 'https://example.com/file.pdf',
        name: 'file.pdf',
      },
    })

    expect(useExternalUrlDropTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      }),
    )
  })

  it('does not register app-internal replacement drops for non-empty embeds', () => {
    renderHookHarness({
      target: {
        kind: 'externalUrl',
        url: 'https://example.com/file.pdf',
        name: 'file.pdf',
      },
    })

    expect(dropTargetState.args).toBeNull()
  })

  it('does not suppress native file drops before the shared external monitor sees them', () => {
    const uploadFile = vi.fn(() =>
      Promise.resolve({ status: 'completed' as const, itemId: sidebarItemId('file-1') }),
    )
    renderHookHarness({ uploadFile })
    const ancestorDrop = vi.fn()
    screen.getByTestId('drop-target').parentElement?.addEventListener('drop', ancestorDrop)

    const { event } = dispatchNativeDrop({
      types: ['Files'],
      files: { item: () => null },
      getData: () => '',
    })

    expect(event.defaultPrevented).toBe(false)
    expect(ancestorDrop).toHaveBeenCalledOnce()
  })

  it('marks the editor boundary while hovering the embed target', () => {
    renderHookHarness()
    const editorElement = screen.getByTestId('drop-target').parentElement
    const editorContainer = editorElement?.parentElement

    const { event } = dispatchNativeDragEvent('dragover', {
      types: [],
      getData: () => '',
    })

    expect(event.defaultPrevented).toBe(false)
    expect(editorElement).toHaveAttribute('data-note-empty-embed-drop-active', 'true')
    expect(editorContainer).toHaveAttribute('data-note-empty-embed-drop-active', 'true')
    expect(document.body).toHaveAttribute('data-note-empty-embed-drop-active', 'true')

    dispatchNativeDragEvent('dragleave', {
      types: [],
      getData: () => '',
    })

    expect(editorElement).not.toHaveAttribute('data-note-empty-embed-drop-active')
    expect(editorContainer).not.toHaveAttribute('data-note-empty-embed-drop-active')
    expect(document.body).not.toHaveAttribute('data-note-empty-embed-drop-active')
  })

  it('reports shared external file upload failures instead of silently keeping the old target', async () => {
    const setTarget = vi.fn(() => Promise.resolve())
    const uploadFile = vi.fn(() =>
      Promise.resolve({ status: 'skipped' as const, reason: 'failed' as const }),
    )
    const file = new File(['x'], 'image.png', { type: 'image/png' })
    renderHookHarness({ setTarget, uploadFile })

    await executeEmptyEmbedFileImport(file)

    expect(console.error).toHaveBeenCalledWith('Could not upload file. Please try again.', {
      status: 'skipped',
      reason: 'failed',
    })
  })
})

function executeEmptyEmbedFileImport(file: File) {
  return executePlannedDropCommand(
    {
      kind: 'surfaceFileImport',
      commandId: 'surface-file-import.empty-embed',
      target: {
        type: EMPTY_EMBED_DROP_TYPE,
        sourceItemId: sidebarItemId('canvas-1'),
        embedBlockId: 'embed-block-1',
      },
      dropResult: { files: [{ file, relativePath: file.name }], rootFolders: [] },
      label: 'Upload to embed',
    },
    { clientX: 0, clientY: 0 },
    {
      executeFileSystemCommand: vi.fn(),
      handleDropFiles: vi.fn(),
      openItem: vi.fn(),
      setBatchDecision: vi.fn(),
    },
  )
}

function createNote(overrides: Parameters<typeof createNoteFixture>[0] = {}) {
  return createNoteFixture({ campaignId, ...overrides })
}

function renderHookHarness({
  embedBlockId = 'embed-block-1',
  sourceCanvasId = sidebarItemId('canvas-1'),
  sourceItemId = sourceCanvasId,
  setTarget = vi.fn(() => Promise.resolve()),
  uploadFile = vi.fn(() =>
    Promise.resolve({ status: 'skipped' as const, reason: 'failed' as const }),
  ),
  dispatchDropPayload,
  target = { kind: 'empty' },
}: {
  embedBlockId?: string
  sourceCanvasId?: SidebarItemId | null
  sourceItemId?: SidebarItemId | null
  setTarget?: (target: EmbedTarget) => Promise<void>
  uploadFile?: (file: File) => Promise<EmbedTargetUploadFileResult>
  dispatchDropPayload?: TestDropPayloadDispatcher
  target?: EmbedTarget
} = {}) {
  const content = (
    <CanvasEmbedDropTargetHarness
      embedBlockId={embedBlockId}
      sourceItemId={sourceItemId}
      setTarget={setTarget}
      elementTestId="drop-target"
      uploadFile={uploadFile}
      target={target}
    />
  )

  return render(
    <DndProviderContext.Provider
      value={{
        canAcceptExternalFiles: true,
        dispatchDropPayload: dispatchDropPayload ?? (() => Promise.resolve()),
        getItemLinkPath: () => [],
        runtimeId: dispatchDropPayload ? 'runtime-test' : '',
      }}
    >
      {content}
    </DndProviderContext.Provider>,
  )
}

function sidebarDragData(itemId: SidebarItemId) {
  return {
    sidebarItemId: itemId,
    sidebarItemIds: [itemId],
    dragPreviewItemIds: [itemId],
  }
}

function CanvasEmbedDropTargetHarness({
  embedBlockId,
  elementTestId,
  sourceItemId,
  setTarget,
  target = { kind: 'empty' },
  uploadFile,
}: {
  embedBlockId: string
  elementTestId: string
  sourceItemId: SidebarItemId | null
  setTarget: (target: EmbedTarget) => Promise<void>
  target?: EmbedTarget
  uploadFile: (file: File) => Promise<EmbedTargetUploadFileResult>
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const dropVisualState = useEmbedDropTarget({
    embedBlockId,
    ref,
    enabled: true,
    sourceItemId,
    setTarget,
    targetKind: target.kind,
    uploadFile,
    uploadSurface: 'canvas',
  })
  return (
    <div className="bn-container">
      <div className="bn-editor">
        <div
          ref={ref}
          data-testid={elementTestId}
          data-drop-target={dropVisualState.isDropTarget ? 'true' : 'false'}
          data-file-drop-target={dropVisualState.isFileDropTarget ? 'true' : 'false'}
        />
      </div>
    </div>
  )
}

function sidebarItemId(value: string): SidebarItemId {
  return value as SidebarItemId
}

function dispatchNativeDrop(dataTransfer: {
  types: Array<string>
  getData: (type: string) => string
  dropEffect?: DataTransfer['dropEffect']
  files?: { item: (index: number) => File | null }
}) {
  return dispatchNativeDragEvent('drop', dataTransfer)
}

function dispatchNativeDragEvent(
  type: 'dragenter' | 'dragover' | 'dragleave' | 'drop',
  dataTransfer: {
    types: Array<string>
    getData: (type: string) => string
    dropEffect?: DataTransfer['dropEffect']
    files?: { item: (index: number) => File | null }
  },
) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  const transfer = {
    files: { item: () => null },
    ...dataTransfer,
  }
  Object.defineProperty(event, 'dataTransfer', {
    value: transfer,
  })
  screen.getByTestId('drop-target').dispatchEvent(event)
  return { event, dataTransfer: transfer }
}
