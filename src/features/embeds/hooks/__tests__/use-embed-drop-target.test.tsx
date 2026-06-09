import { act, render, screen, waitFor } from '@testing-library/react'
import { useRef } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEmbedDropTarget } from '../use-embed-drop-target'
import { testId } from '~/test/helpers/test-id'
import type { Id } from 'convex/_generated/dataModel'
import type { EmbedTarget } from 'shared/embeds/embedTargets'
import { EMPTY_EMBED_DROP_TYPE } from '~/features/dnd/utils/drop-target-data'

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
const handleErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  dropTargetForElements: vi.fn((args) => {
    dropTargetState.args = args
    return vi.fn()
  }),
}))

vi.mock('~/shared/utils/logger', () => ({
  handleError: handleErrorMock,
}))

describe('useEmbedDropTarget', () => {
  beforeEach(() => {
    dropTargetState.args = null
    handleErrorMock.mockReset()
  })

  it('replaces from sidebar item drops and rejects the current canvas', async () => {
    const setTarget = vi.fn(() => Promise.resolve())
    renderHookHarness({ sourceItemId: testId<'sidebarItems'>('canvas-1'), setTarget })

    await waitFor(() => expect(dropTargetState.args).not.toBeNull())

    expect(
      dropTargetState.args!.canDrop({
        source: { data: sidebarDragData(testId<'sidebarItems'>('canvas-1')) },
      }),
    ).toBe(false)
    expect(
      dropTargetState.args!.canDrop({
        source: { data: sidebarDragData(testId<'sidebarItems'>('note-1')) },
      }),
    ).toBe(true)
    expect(dropTargetState.args!.getData?.()).toEqual({
      type: EMPTY_EMBED_DROP_TYPE,
      sourceItemId: testId<'sidebarItems'>('canvas-1'),
    })

    dropTargetState.args!.onDrop({
      source: { data: sidebarDragData(testId<'sidebarItems'>('note-1')) },
    })

    await waitFor(() =>
      expect(setTarget).toHaveBeenCalledWith({
        kind: 'sidebarItem',
        sidebarItemId: testId<'sidebarItems'>('note-1'),
      }),
    )
  })

  it('ignores editor block drag data that only contains embed block props', async () => {
    const setTarget = vi.fn(() => Promise.resolve())
    renderHookHarness({ setTarget })

    await waitFor(() => expect(dropTargetState.args).not.toBeNull())

    const blockDragData = {
      targetKind: 'sidebarItem',
      sidebarItemId: testId<'sidebarItems'>('note-1'),
    }

    expect(dropTargetState.args!.canDrop({ source: { data: blockDragData } })).toBe(false)

    dropTargetState.args!.onDrop({ source: { data: blockDragData } })

    expect(setTarget).not.toHaveBeenCalled()
  })

  it('rejects sidebar item drops when the extracted item is not in the drag id set', async () => {
    const setTarget = vi.fn(() => Promise.resolve())
    renderHookHarness({ setTarget })

    await waitFor(() => expect(dropTargetState.args).not.toBeNull())

    const forgedDragData = {
      sidebarItemId: testId<'sidebarItems'>('note-1'),
      sidebarItemIds: [testId<'sidebarItems'>('note-2')],
    }

    expect(dropTargetState.args!.canDrop({ source: { data: forgedDragData } })).toBe(false)

    dropTargetState.args!.onDrop({ source: { data: forgedDragData } })

    expect(setTarget).not.toHaveBeenCalled()
  })

  it('rejects multi-item sidebar drops because one empty embed has one target slot', async () => {
    const setTarget = vi.fn(() => Promise.resolve())
    renderHookHarness({ sourceItemId: testId<'sidebarItems'>('canvas-1'), setTarget })

    await waitFor(() => expect(dropTargetState.args).not.toBeNull())

    const multiItemDragData = {
      sidebarItemId: testId<'sidebarItems'>('note-1'),
      sidebarItemIds: [testId<'sidebarItems'>('note-1'), testId<'sidebarItems'>('note-2')],
    }

    expect(dropTargetState.args!.canDrop({ source: { data: multiItemDragData } })).toBe(false)

    dropTargetState.args!.onDrop({ source: { data: multiItemDragData } })

    expect(setTarget).not.toHaveBeenCalled()
  })

  it('reports valid sidebar item drops as active shared drop target feedback', async () => {
    renderHookHarness({ sourceItemId: testId<'sidebarItems'>('canvas-1') })

    await waitFor(() => expect(dropTargetState.args).not.toBeNull())

    act(() => {
      dropTargetState.args!.onDragEnter({
        source: { data: sidebarDragData(testId<'sidebarItems'>('note-1')) },
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
    renderHookHarness({ sourceItemId: testId<'sidebarItems'>('canvas-1') })

    await waitFor(() => expect(dropTargetState.args).not.toBeNull())

    act(() => {
      dropTargetState.args!.onDragEnter({
        source: { data: sidebarDragData(testId<'sidebarItems'>('canvas-1')) },
      })
    })

    expect(screen.getByTestId('drop-target')).toHaveAttribute('data-drop-target', 'false')
  })

  it('replaces from external URL drops', async () => {
    const setTarget = vi.fn(() => Promise.resolve())
    renderHookHarness({ setTarget })

    dispatchNativeDrop({
      types: ['text/plain'],
      getData: (type) => (type === 'text/plain' ? 'https://example.com/file.pdf' : ''),
    })

    await waitFor(() =>
      expect(setTarget).toHaveBeenCalledWith({
        kind: 'externalUrl',
        url: 'https://example.com/file.pdf',
        name: 'file.pdf',
      }),
    )
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
    expect(setTarget).not.toHaveBeenCalled()
  })

  it('replaces from uri-list URL drops with comments', async () => {
    const setTarget = vi.fn(() => Promise.resolve())
    renderHookHarness({ setTarget })

    dispatchNativeDrop({
      types: ['text/uri-list', 'text/plain'],
      getData: (type) =>
        type === 'text/uri-list'
          ? '# SourceURL: https://ignored.example\nhttps://example.com/file.pdf'
          : 'https://fallback.example/fallback.pdf',
    })

    await waitFor(() =>
      expect(setTarget).toHaveBeenCalledWith({
        kind: 'externalUrl',
        url: 'https://example.com/file.pdf',
        name: 'file.pdf',
      }),
    )
  })

  it('uploads native files before replacing the embed target', async () => {
    const setTarget = vi.fn(() => Promise.resolve())
    const uploadFile = vi.fn(() => Promise.resolve(testId<'sidebarItems'>('file-1')))
    const file = new File(['x'], 'image.png', { type: 'image/png' })
    renderHookHarness({ setTarget, uploadFile })

    dispatchNativeDrop({
      types: ['Files'],
      files: { item: () => file },
      getData: () => '',
    })

    await waitFor(() => expect(uploadFile).toHaveBeenCalledWith(file))
    expect(setTarget).toHaveBeenCalledWith({
      kind: 'sidebarItem',
      sidebarItemId: testId<'sidebarItems'>('file-1'),
    })
  })

  it('reports native file drags as active file drop target feedback until drop', async () => {
    const uploadFile = vi.fn(() => Promise.resolve(testId<'sidebarItems'>('file-1')))
    const file = new File(['x'], 'image.png', { type: 'image/png' })
    renderHookHarness({ uploadFile })

    act(() => {
      dispatchNativeDragEvent('dragenter', {
        types: ['Files'],
        files: { item: () => file },
        getData: () => '',
      })
    })

    expect(screen.getByTestId('drop-target')).toHaveAttribute('data-drop-target', 'true')
    expect(screen.getByTestId('drop-target')).toHaveAttribute('data-file-drop-target', 'true')

    act(() => {
      dispatchNativeDrop({
        types: ['Files'],
        files: { item: () => file },
        getData: () => '',
      })
    })

    await waitFor(() =>
      expect(screen.getByTestId('drop-target')).toHaveAttribute('data-drop-target', 'false'),
    )
  })

  it('keeps editor dragover handlers from reacting while hovering the embed target', () => {
    renderHookHarness()
    const editorElement = screen.getByTestId('drop-target').parentElement
    const editorContainer = editorElement?.parentElement
    const parentDragOver = vi.fn()
    editorElement?.addEventListener('dragover', parentDragOver)

    const { event } = dispatchNativeDragEvent('dragover', {
      types: [],
      getData: () => '',
    })

    expect(parentDragOver).not.toHaveBeenCalled()
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

  it('reports native file upload failures instead of silently keeping the old target', async () => {
    const setTarget = vi.fn(() => Promise.resolve())
    const uploadFile = vi.fn(() => Promise.resolve(null))
    const file = new File(['x'], 'image.png', { type: 'image/png' })
    renderHookHarness({ setTarget, uploadFile })

    dispatchNativeDrop({
      types: ['Files'],
      files: { item: () => file },
      getData: () => '',
    })

    await waitFor(() =>
      expect(handleErrorMock).toHaveBeenCalledWith(
        expect.any(Error),
        'Could not upload file. Please try again.',
      ),
    )
    expect(setTarget).not.toHaveBeenCalled()
  })
})

function renderHookHarness({
  sourceCanvasId = testId<'sidebarItems'>('canvas-1'),
  sourceItemId = sourceCanvasId,
  setTarget = vi.fn(() => Promise.resolve()),
  uploadFile = vi.fn(() => Promise.resolve(null)),
}: {
  sourceCanvasId?: Id<'sidebarItems'> | null
  sourceItemId?: Id<'sidebarItems'> | null
  setTarget?: (target: EmbedTarget) => Promise<void>
  uploadFile?: (file: File) => Promise<Id<'sidebarItems'> | null>
} = {}) {
  return render(
    <CanvasEmbedDropTargetHarness
      sourceItemId={sourceItemId}
      setTarget={setTarget}
      uploadFile={uploadFile}
    />,
  )
}

function sidebarDragData(sidebarItemId: Id<'sidebarItems'>) {
  return {
    sidebarItemId,
    sidebarItemIds: [sidebarItemId],
    sidebarDragPreviewItemIds: [sidebarItemId],
  }
}

function CanvasEmbedDropTargetHarness({
  sourceItemId,
  setTarget,
  uploadFile,
}: {
  sourceItemId: Id<'sidebarItems'> | null
  setTarget: (target: EmbedTarget) => Promise<void>
  uploadFile: (file: File) => Promise<Id<'sidebarItems'> | null>
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const dropVisualState = useEmbedDropTarget({
    ref,
    enabled: true,
    sourceItemId,
    setTarget,
    uploadFile,
  })
  return (
    <div className="bn-container">
      <div className="bn-editor">
        <div
          ref={ref}
          data-testid="drop-target"
          data-drop-target={dropVisualState.isDropTarget ? 'true' : 'false'}
          data-file-drop-target={dropVisualState.isFileDropTarget ? 'true' : 'false'}
        />
      </div>
    </div>
  )
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
