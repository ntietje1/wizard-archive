import {
  act,
  fireEvent,
  render as renderWithTestingLibrary,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'
import { NoteEmbedBlockView } from '../embed-block'
import { AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK } from '../../../embeds/utils/media'
import {
  DOCUMENT_EMBED_ASPECT_RATIO_HEIGHT,
  DOCUMENT_EMBED_ASPECT_RATIO_WIDTH,
} from '../../../embeds/utils/document-layout'
import { clearInternalNativeDrag } from '@wizard-archive/ui/drag-drop/internal-native-drag'
import { classifyExternalUrlDrop } from '../../../drag-drop/external-url-drop'
import { NoteEmbedSurfaceProvider } from '../surface-context'
import { EMPTY_EMBED_DROP_TYPE } from '../../../drag-drop/drop-target-data'
import { executeRegisteredSurfaceDropCommand } from '../../../drag-drop/surface-command'
import { createNote } from '../../../test/sidebar-item-factory'
import { BlockNoteContextMenuContext } from '../../context-menu/blocknote-context-menu'
import type { BlockNoteContextMenuContextType } from '../../context-menu/blocknote-context-menu'
import type { ReactElement } from 'react'

const uploadEmbedFileMock = vi.hoisted(() => vi.fn())
const blockDragStartMock = vi.hoisted(() => vi.fn())
const blockDragEndMock = vi.hoisted(() => vi.fn())
const openContextMenuMock = vi.hoisted(() => vi.fn())
const embedResourceContentState = vi.hoisted((): { data: Record<string, unknown> | null } => ({
  data: null,
}))
type ElementDropTargetArgs = {
  canDrop: (args: { source: { data: Record<string, unknown> } }) => boolean
  onDragEnter: (args: { source: { data: Record<string, unknown> } }) => void
  onDragLeave: () => void
  onDrop: (args: { source: { data: Record<string, unknown> } }) => void
}
const dropTargetForElementsMock = vi.hoisted(() => vi.fn((_args: ElementDropTargetArgs) => vi.fn()))
const documentEmbedAspectRatio = Number(
  (DOCUMENT_EMBED_ASPECT_RATIO_WIDTH / DOCUMENT_EMBED_ASPECT_RATIO_HEIGHT).toFixed(6),
)

function render(ui: ReactElement) {
  return renderWithTestingLibrary(
    <BlockNoteContextMenuContext.Provider value={createContextMenuValue()}>
      <NoteEmbedSurfaceProvider editable sourceNoteId={'note-1' as never}>
        {ui}
      </NoteEmbedSurfaceProvider>
    </BlockNoteContextMenuContext.Provider>,
  )
}

vi.mock('@blocknote/react', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    useExtension: () => ({
      blockDragStart: blockDragStartMock,
      blockDragEnd: blockDragEndMock,
    }),
  }
})

vi.mock('../../../embeds/components/embed-content', async () => {
  const { makeMockEmbedContent } = await import('./mock-embed-content')
  return { EmbedContent: makeMockEmbedContent() }
})

vi.mock('../../../filesystem/resource-content-context', () => ({
  useResourceContentState: () => {
    if (!embedResourceContentState.data) {
      return {
        status: 'not_found',
        label: 'Embedded item',
        item: undefined,
        folderChildren: [],
        isLoading: false,
        error: null,
      }
    }

    const label =
      typeof embedResourceContentState.data.name === 'string'
        ? embedResourceContentState.data.name
        : 'Embedded item'

    return {
      status: 'ready',
      label,
      item: embedResourceContentState.data,
      folderChildren: [],
      isLoading: false,
      error: null,
    }
  },
}))

vi.mock('@atlaskit/pragmatic-drag-and-drop/element/adapter', () => ({
  dropTargetForElements: (args: ElementDropTargetArgs) => dropTargetForElementsMock(args),
}))

describe('NoteEmbedBlockView', () => {
  beforeEach(() => {
    uploadEmbedFileMock.mockReset()
    blockDragStartMock.mockReset()
    blockDragEndMock.mockReset()
    dropTargetForElementsMock.mockClear()
    dropTargetForElementsMock.mockReturnValue(vi.fn())
    openContextMenuMock.mockReset()
    embedResourceContentState.data = null
    clearInternalNativeDrag()
  })

  afterEach(() => {
    clearInternalNativeDrag()
    window.getSelection()?.removeAllRanges()
  })

  it('renders an empty shared embed in editable mode', async () => {
    render(
      <NoteEmbedBlockView
        block={{ id: 'block-1', props: { targetKind: 'empty' } } as never}
        editor={createEditor() as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    expect(await screen.findByTestId('shared-embed-content')).toHaveAttribute('data-kind', 'empty')
    expect(screen.getByTestId('shared-embed-content')).toHaveAttribute('data-mode', 'editable')
    expect(screen.getByTestId('shared-embed-content')).toHaveAttribute(
      'data-allow-inner-scroll',
      'false',
    )
  })

  it('marks editable empty embeds as BlockNote external drop targets', () => {
    render(
      <NoteEmbedBlockView
        block={{ id: 'block-1', props: { targetKind: 'empty' } } as never}
        editor={createEditor() as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    expect(screen.getByTestId('note-embed-block')).toHaveAttribute(
      'data-blocknote-external-drop-target',
      'true',
    )
  })

  it('does not mark read-only empty embeds as BlockNote external drop targets', () => {
    render(
      <NoteEmbedBlockView
        block={{ id: 'block-1', props: { targetKind: 'empty' } } as never}
        editor={createEditor() as never}
        editable={false}
        sourceNoteId={'note-1' as never}
      />,
    )

    expect(screen.getByTestId('note-embed-block')).not.toHaveAttribute(
      'data-blocknote-external-drop-target',
    )
  })

  it('does not mark editable non-empty embeds as BlockNote external drop targets', () => {
    render(
      <NoteEmbedBlockView
        block={
          {
            id: 'block-1',
            props: {
              targetKind: 'externalUrl',
              url: 'https://example.com/bestiary.pdf',
              name: 'Bestiary',
            },
          } as never
        }
        editor={createEditor() as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    expect(screen.getByTestId('note-embed-block')).not.toHaveAttribute(
      'data-blocknote-external-drop-target',
    )
  })

  it('marks editable non-empty embeds as BlockNote external drop blockers', () => {
    render(
      <NoteEmbedBlockView
        block={
          {
            id: 'block-1',
            props: {
              targetKind: 'externalUrl',
              url: 'https://example.com/bestiary.pdf',
              name: 'Bestiary',
            },
          } as never
        }
        editor={createEditor() as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    expect(screen.getByTestId('note-embed-block')).toHaveAttribute(
      'data-blocknote-external-drop-blocked',
      'true',
    )
  })

  it('does not mark editable empty embeds as BlockNote external drop blockers', () => {
    render(
      <NoteEmbedBlockView
        block={{ id: 'block-1', props: { targetKind: 'empty' } } as never}
        editor={createEditor() as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    expect(screen.getByTestId('note-embed-block')).not.toHaveAttribute(
      'data-blocknote-external-drop-blocked',
    )
  })

  it('renders a filled header from an external target name', async () => {
    render(
      <NoteEmbedBlockView
        block={
          {
            id: 'block-1',
            props: {
              targetKind: 'externalUrl',
              url: 'https://example.com/bestiary.pdf',
              name: 'Bestiary',
            },
          } as never
        }
        editor={createEditor() as never}
        editable={false}
        sourceNoteId={'note-1' as never}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Bestiary' })).toBeInTheDocument()
    expect(await screen.findByTestId('shared-embed-content')).toHaveAttribute(
      'data-mode',
      'readonly',
    )
  })

  it('converts an external link into primitive embed props', async () => {
    const user = userEvent.setup()
    const editor = createEditor()
    const block = { id: 'block-1', type: 'embed', props: { targetKind: 'empty' } }

    render(
      <NoteEmbedBlockView
        block={block as never}
        editor={editor as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    await user.click(await screen.findByRole('button', { name: 'mock link' }))
    await user.type(screen.getByLabelText('External file URL'), 'https://example.com/audio.mp3')
    await user.click(screen.getByRole('button', { name: 'Link' }))

    expect(editor.replaceBlocks).toHaveBeenCalledWith(
      [block],
      [
        {
          ...block,
          props: {
            previewWidth: 480,
            targetKind: 'externalUrl',
            url: 'https://example.com/audio.mp3',
            name: 'audio.mp3',
          },
        },
      ],
    )
  })

  it('replaces stale locator props when switching target kinds', async () => {
    const editor = createEditor()
    const block = {
      id: 'block-1',
      type: 'embed',
      props: {
        targetKind: 'empty',
        url: 'https://example.com/old.pdf',
        name: 'old.pdf',
        previewWidth: 320,
        previewHeight: 200,
      },
      content: [],
      children: [],
    }

    render(
      <NoteEmbedBlockView
        block={block as never}
        editor={editor as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    await getRegisteredElementDropTarget()

    await executeNoteEmbedSurfaceDrop('map-1')

    await waitFor(() =>
      expect(editor.replaceBlocks).toHaveBeenCalledWith(
        [block],
        [
          {
            ...block,
            props: {
              previewWidth: 320,
              previewHeight: 200,
              targetKind: 'resource',
              resourceId: 'map-1',
            },
          },
        ],
      ),
    )
  })

  it('uploads selected files before embedding the created sidebar item', async () => {
    uploadEmbedFileMock.mockResolvedValue({ status: 'completed', itemId: 'file-1' })
    const user = userEvent.setup()
    const editor = createEditor()
    const block = { id: 'block-1', type: 'embed', props: { targetKind: 'empty' } }
    const { container } = render(
      <NoteEmbedSurfaceProvider
        sourceNoteId={'note-1' as never}
        editable
        embedTargetOperations={{ uploadFile: uploadEmbedFileMock }}
      >
        <NoteEmbedBlockView
          block={block as never}
          editor={editor as never}
          editable
          sourceNoteId={'note-1' as never}
        />
      </NoteEmbedSurfaceProvider>,
    )
    const input = container.querySelector('input[type="file"]')
    expect(input).toBeInstanceOf(HTMLInputElement)

    await user.upload(
      input as HTMLInputElement,
      new File(['data'], 'asset.png', { type: 'image/png' }),
    )

    expect(uploadEmbedFileMock).toHaveBeenCalledWith(expect.any(File))
    await waitFor(() =>
      expect(editor.replaceBlocks).toHaveBeenCalledWith(
        [block],
        [
          {
            ...block,
            props: {
              previewWidth: 480,
              targetKind: 'resource',
              resourceId: 'file-1',
            },
          },
        ],
      ),
    )
  })

  it('accepts sidebar item drops onto the embed block', async () => {
    const editor = createEditor()
    const block = { id: 'block-1', type: 'embed', props: { targetKind: 'empty' } }
    render(
      <NoteEmbedBlockView
        block={block as never}
        editor={editor as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    const dropTargetArgs = await getRegisteredElementDropTarget()

    expect(dropTargetArgs!.canDrop({ source: { data: sidebarDragData('map-1') } })).toBe(true)

    await executeNoteEmbedSurfaceDrop('map-1')

    await waitFor(() =>
      expect(editor.replaceBlocks).toHaveBeenCalledWith(
        [block],
        [
          {
            ...block,
            props: {
              previewWidth: 480,
              targetKind: 'resource',
              resourceId: 'map-1',
            },
          },
        ],
      ),
    )
  })

  it('shows shared drop target feedback on empty note embeds during valid sidebar item drags', async () => {
    render(
      <NoteEmbedBlockView
        block={{ id: 'block-1', type: 'embed', props: { targetKind: 'empty' } } as never}
        editor={createEditor() as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    const dropTargetArgs = await getRegisteredElementDropTarget()

    act(() => {
      dropTargetArgs!.onDragEnter({ source: { data: sidebarDragData('map-1') } })
    })

    expect(await screen.findByTestId('shared-embed-content')).toHaveAttribute(
      'data-drop-target',
      'true',
    )
    expect(screen.getByTestId('shared-embed-content')).toHaveAttribute(
      'data-file-drop-target',
      'false',
    )

    act(() => {
      dropTargetArgs!.onDragLeave()
    })

    expect(screen.getByTestId('shared-embed-content')).toHaveAttribute('data-drop-target', 'false')
  })

  it('selects embed blocks on click and renders canvas-style resize chrome', () => {
    const editor = { ...createEditor(), domElement: createEditorElement(308) }
    const block = {
      id: 'block-1',
      props: {
        targetKind: 'externalUrl',
        url: 'https://example.com/map.png',
        name: 'Map',
        previewWidth: 300,
      },
    }
    render(
      <NoteEmbedBlockView
        block={block as never}
        editor={editor as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    expect(screen.getByTestId('note-embed-block')).toHaveClass('allow-motion')

    fireEvent.pointerDown(screen.getByTestId('note-embed-visual-surface'), { button: 0 })

    expect(editor.setTextCursorPosition).toHaveBeenCalledWith(block, 'start')
    expect(screen.getByTestId('shared-embed-content')).toHaveAttribute(
      'data-allow-inner-scroll',
      'true',
    )
    expect(screen.getByTestId('note-embed-resize-wrapper')).toBeInTheDocument()
    expect(screen.getByTestId('note-embed-visual-surface')).toHaveAttribute(
      'contenteditable',
      'false',
    )
    expect(screen.getByTestId('note-embed-visual-surface')).toHaveAttribute('draggable', 'false')
    expect(screen.getByTestId('note-embed-resize-fill')).toHaveClass('bg-canvas-selection-fill')
    expect(screen.getByTestId('note-embed-resize-outline')).toBeInTheDocument()
    expect(screen.getByTestId('note-embed-block')).toHaveClass('select-none')
    expect(screen.getByTestId('note-embed-visual-surface')).toHaveClass('select-none')
    expect(screen.queryAllByTestId(/note-embed-resize-zone-/)).toHaveLength(8)
    expect(screen.getByRole('button', { name: 'Resize top selection edge' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Resize bottom-right selection corner' }),
    ).toBeInTheDocument()
    const rightResizeHandle = screen.getByRole('button', {
      name: 'Resize right selection edge',
    })
    expect(rightResizeHandle).not.toHaveAttribute('tabindex', '-1')

    fireEvent.keyDown(rightResizeHandle, { key: 'ArrowRight' })

    expect(editor.updateBlock).toHaveBeenCalledWith(block, {
      props: { previewWidth: 308 },
    })

    editor.updateBlock.mockClear()
    const cornerResizeHandle = screen.getByRole('button', {
      name: 'Resize bottom-right selection corner',
    })
    fireEvent.keyDown(cornerResizeHandle, { key: 'ArrowRight' })
    expect(editor.updateBlock).toHaveBeenCalledWith(block, {
      props: { previewWidth: 308 },
    })

    editor.updateBlock.mockClear()
    fireEvent.keyDown(cornerResizeHandle, { key: 'Enter' })
    expect(editor.updateBlock).not.toHaveBeenCalled()
  })

  it('highlights an embed while the native text range continues beyond it', () => {
    const editor = createEditor()
    render(
      <div className="bn-editor">
        <p data-testid="selection-anchor">Before embed</p>
        <div data-node-type="blockOuter" data-testid="embed-block-boundary">
          <div data-content-type="embed">
            <NoteEmbedBlockView
              block={
                {
                  id: 'block-1',
                  props: {
                    targetKind: 'externalUrl',
                    url: 'https://example.com/map.png',
                    name: 'Map',
                  },
                } as never
              }
              editor={editor as never}
              editable
              sourceNoteId={'note-1' as never}
            />
          </div>
        </div>
        <p data-testid="selection-continuation">After embed</p>
      </div>,
    )
    const anchorNode = screen.getByTestId('selection-anchor').firstChild
    if (!anchorNode) throw new Error('Expected text selection anchor')
    const range = document.createRange()
    range.setStart(anchorNode, 1)
    range.collapse(true)
    window.getSelection()?.addRange(range)

    const embed = screen.getByTestId('note-embed-block')
    fireEvent.mouseMove(embed, { buttons: 1 })

    expect(screen.getByTestId('note-embed-resize-outline')).toBeInTheDocument()
    expect(window.getSelection()?.anchorNode).toBe(anchorNode)

    const continuationNode = screen.getByTestId('selection-continuation').firstChild
    if (!continuationNode) throw new Error('Expected text selection continuation')
    window.getSelection()?.setBaseAndExtent(anchorNode, 1, continuationNode, 5)
    document.dispatchEvent(new Event('selectionchange'))

    expect(screen.getByTestId('note-embed-resize-outline')).toBeInTheDocument()
    expect(window.getSelection()?.anchorNode).toBe(anchorNode)
  })

  it('keeps an embed in a non-collapsed selection when the drag ends over it', async () => {
    const editor = createEditor()
    const block = { id: 'block-1', props: { targetKind: 'empty' } }
    render(
      <div className="bn-editor">
        <p data-testid="selection-anchor">Before embed</p>
        <div data-node-type="blockOuter" data-testid="embed-block-boundary">
          <div data-content-type="embed">
            <NoteEmbedBlockView
              block={block as never}
              editor={editor as never}
              editable
              sourceNoteId={'note-1' as never}
            />
          </div>
        </div>
      </div>,
    )
    const anchorNode = screen.getByTestId('selection-anchor').firstChild
    const blockBoundary = screen.getByTestId('embed-block-boundary')
    const blockParent = blockBoundary.parentNode
    if (!anchorNode || !blockParent) throw new Error('Expected text and embed selection nodes')
    const blockIndex = Array.from(blockParent.childNodes).indexOf(blockBoundary)
    window.getSelection()?.setBaseAndExtent(anchorNode, 1, blockParent, blockIndex)

    const embed = screen.getByTestId('note-embed-block')
    fireEvent.mouseMove(embed, { buttons: 1 })
    fireEvent.pointerUp(embed, { button: 0 })
    fireEvent.mouseUp(embed, { button: 0 })

    await waitFor(() => {
      expect(editor.extendTextSelectionToBlockBoundary).toHaveBeenCalledWith(block.id)
    })
  })

  it('reserves a known intrinsic aspect ratio before media finishes rendering', () => {
    const editor = createEditor()
    const block = {
      id: 'block-1',
      props: {
        targetKind: 'externalUrl',
        url: 'https://example.com/bestiary.pdf',
        name: 'Bestiary',
        previewWidth: 300,
        previewAspectRatio: 0.75,
      },
    }

    render(
      <NoteEmbedBlockView
        block={block as never}
        editor={editor as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    const body = screen
      .getByTestId('note-embed-block')
      .querySelector('[data-note-embed-body="true"]')
    expect(body).toBeInstanceOf(HTMLElement)
    expect((body as HTMLElement).style.aspectRatio).toBe('0.75 / 1')
  })

  it('reserves the document aspect ratio for external PDFs before media finishes rendering', () => {
    const editor = createEditor()
    const block = {
      id: 'block-1',
      props: {
        targetKind: 'externalUrl',
        url: 'https://example.com/bestiary.pdf',
        name: 'Bestiary',
        previewWidth: 300,
      },
    }

    render(
      <NoteEmbedBlockView
        block={block as never}
        editor={editor as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    const body = screen
      .getByTestId('note-embed-block')
      .querySelector('[data-note-embed-body="true"]')
    expect(body).toBeInstanceOf(HTMLElement)
    expect((body as HTMLElement).style.aspectRatio).toBe(`${documentEmbedAspectRatio} / 1`)
  })

  it('uses the document shape as the default height for resolved note sidebar item embeds', () => {
    const editor = createEditor()
    const block = {
      id: 'block-1',
      props: {
        targetKind: 'resource',
        resourceId: 'note-2',
        previewWidth: 300,
      },
    }
    embedResourceContentState.data = {
      id: 'note-2',
      type: RESOURCE_TYPES.notes,
      name: 'Nested Note',
    }

    render(
      <NoteEmbedBlockView
        block={block as never}
        editor={editor as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    const body = screen
      .getByTestId('note-embed-block')
      .querySelector('[data-note-embed-body="true"]')
    expect(body).toBeInstanceOf(HTMLElement)
    expect((body as HTMLElement).style.aspectRatio).toBe('')
    expect((body as HTMLElement).style.height).toBe('388px')
  })

  it('opens the workspace context menu for available embedded sidebar items', async () => {
    const editor = createEditor()
    const embeddedItem = {
      id: 'note-2',
      type: RESOURCE_TYPES.notes,
      name: 'Nested Note',
    }
    embedResourceContentState.data = embeddedItem

    render(
      <NoteEmbedBlockView
        block={
          {
            id: 'block-1',
            props: {
              targetKind: 'resource',
              resourceId: 'note-2',
            },
          } as never
        }
        editor={editor as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    fireEvent.contextMenu(await screen.findByTestId('note-embed-visual-surface'), {
      clientX: 42,
      clientY: 88,
    })

    expect(openContextMenuMock).toHaveBeenCalledWith(
      expect.objectContaining({
        position: { x: 42, y: 88 },
        surface: 'note-view',
        item: embeddedItem,
      }),
    )
  })

  it('persists reported intrinsic aspect ratios for stable refresh layout', async () => {
    const user = userEvent.setup()
    const editor = createEditor()
    const block = {
      id: 'block-1',
      props: {
        targetKind: 'externalUrl',
        url: 'https://example.com/map.png',
        name: 'Map',
        previewWidth: 300,
      },
    }

    render(
      <NoteEmbedBlockView
        block={block as never}
        editor={editor as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    await user.click(await screen.findByRole('button', { name: 'mock aspect ratio' }))

    expect(editor.updateBlock).toHaveBeenCalledWith(block, {
      props: {
        previewAspectRatio: 16 / 9,
      },
    })
  })

  it('allows BlockNote to start embed block drags', async () => {
    const editor = createEditor()
    render(
      <NoteEmbedBlockView
        block={
          {
            id: 'block-1',
            props: {
              targetKind: 'externalUrl',
              url: 'https://example.com/sound.mp3',
              name: 'Sound',
            },
          } as never
        }
        editor={editor as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    await screen.findByTestId('shared-embed-content')

    const root = screen.getByTestId('note-embed-block')
    expect(fireEvent.dragStart(root)).toBe(true)
    expect(blockDragStartMock).toHaveBeenCalledWith(expect.any(Object), expect.any(Object))
  })

  it('marks embed block drags as app-internal native drags', async () => {
    const editor = createEditor()
    render(
      <NoteEmbedBlockView
        block={
          {
            id: 'block-1',
            props: {
              targetKind: 'externalUrl',
              url: 'https://example.com/map.png',
              name: 'Map',
            },
          } as never
        }
        editor={editor as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    await screen.findByTestId('shared-embed-content')

    fireEvent.dragStart(screen.getByTestId('note-embed-block'))
    expect(blockDragStartMock).toHaveBeenCalled()

    fireEvent.dragEnd(screen.getByTestId('note-embed-block'))
    expect(blockDragEndMock).toHaveBeenCalled()

    expect(
      classifyExternalUrlDrop(
        createDataTransfer({ 'text/plain': 'https://example.com/copy.png' }),
        { readData: true },
      ),
    ).toEqual({
      kind: 'accepted',
      target: {
        kind: 'externalUrl',
        url: 'https://example.com/copy.png',
        name: 'copy.png',
      },
    })
  })

  it('resizes embed blocks by mutating width until committing preview width on release', () => {
    const editor = createEditor()
    const block = {
      id: 'block-1',
      props: {
        targetKind: 'externalUrl',
        url: 'https://example.com/map.png',
        name: 'Map',
        previewWidth: 300,
      },
    }
    render(
      <NoteEmbedBlockView
        block={block as never}
        editor={editor as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    const root = screen.getByTestId('note-embed-block')
    fireEvent.pointerDown(root, { button: 0 })

    const handle = screen.getByRole('button', { name: 'Resize right selection edge' })

    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 })
    fireEvent.pointerMove(window, { clientX: 160, clientY: 999, shiftKey: true })

    expect(root).toHaveStyle({ width: '360px' })
    expect(root.style.height).toBe('')
    fireEvent.pointerUp(window)

    expect(root).toHaveStyle({ width: '360px' })
    expect(root.style.height).toBe('')
    expect(editor.updateBlock).toHaveBeenCalledWith(block, {
      props: {
        previewWidth: 360,
      },
    })
  })

  it('resizes from the left handle using BlockNote width semantics', () => {
    const editor = createEditor()
    const block = {
      id: 'block-1',
      props: {
        targetKind: 'externalUrl',
        url: 'https://example.com/map.png',
        name: 'Map',
        previewWidth: 300,
      },
    }
    render(
      <NoteEmbedBlockView
        block={block as never}
        editor={editor as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    const root = screen.getByTestId('note-embed-block')
    fireEvent.pointerDown(root, { button: 0 })

    const handle = screen.getByRole('button', { name: 'Resize left selection edge' })

    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 })
    fireEvent.pointerMove(window, { clientX: 40, clientY: 125 })

    expect(root).toHaveStyle({ width: '360px' })
    expect(root.style.height).toBe('')

    fireEvent.pointerUp(window)
    expect(root).toHaveStyle({ width: '360px' })
    expect(root.style.height).toBe('')
    expect(editor.updateBlock).toHaveBeenCalledWith(block, {
      props: {
        previewWidth: 360,
      },
    })
  })

  it('resizes from vertical handles through the embed aspect ratio', () => {
    const editor = createEditor()
    const block = {
      id: 'block-1',
      props: {
        targetKind: 'externalUrl',
        url: 'https://example.com/map.png',
        name: 'Map',
        previewWidth: 300,
      },
    }
    render(
      <NoteEmbedBlockView
        block={block as never}
        editor={editor as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    const root = screen.getByTestId('note-embed-block')
    Object.defineProperty(root, 'clientHeight', {
      configurable: true,
      value: 200,
    })

    fireEvent.pointerDown(root, { button: 0 })

    const handle = screen.getByRole('button', { name: 'Resize bottom selection edge' })

    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 })
    fireEvent.pointerMove(window, { clientX: 100, clientY: 140 })

    expect(root).toHaveStyle({ width: '360px' })
    expect(root.style.height).toBe('')

    fireEvent.pointerUp(window)
    expect(editor.updateBlock).toHaveBeenCalledWith(block, {
      props: {
        previewWidth: 360,
      },
    })
  })

  it('resizes resolved note embeds freely after using the document-shaped default height', () => {
    const editor = createEditor()
    const block = {
      id: 'block-1',
      props: {
        targetKind: 'resource',
        resourceId: 'note-2',
        previewWidth: 300,
      },
    }
    embedResourceContentState.data = {
      id: 'note-2',
      type: RESOURCE_TYPES.notes,
      name: 'Nested Note',
    }
    render(
      <NoteEmbedBlockView
        block={block as never}
        editor={editor as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    const root = screen.getByTestId('note-embed-block')
    const body = root.querySelector('[data-note-embed-body="true"]')
    expect(body).toBeInstanceOf(HTMLElement)
    expect((body as HTMLElement).style.height).toBe('388px')

    fireEvent.pointerDown(root, { button: 0 })

    const handle = screen.getByRole('button', { name: 'Resize bottom selection edge' })

    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 })
    fireEvent.pointerMove(window, { clientX: 100, clientY: 140 })

    expect(root).toHaveStyle({ width: '300px' })
    expect(body).toHaveStyle({ height: '428px' })

    fireEvent.pointerUp(window)
    expect(editor.updateBlock).toHaveBeenCalledWith(block, {
      props: {
        previewWidth: 300,
        previewHeight: 428,
      },
    })
  })

  it('uses the document shape as the default height for resolved canvas sidebar item embeds', () => {
    const editor = createEditor()
    const block = {
      id: 'block-1',
      props: {
        targetKind: 'resource',
        resourceId: 'canvas-2',
        previewWidth: 300,
      },
    }
    embedResourceContentState.data = {
      id: 'canvas-2',
      type: RESOURCE_TYPES.canvases,
      name: 'Nested Canvas',
    }
    render(
      <NoteEmbedBlockView
        block={block as never}
        editor={editor as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    const body = screen
      .getByTestId('note-embed-block')
      .querySelector('[data-note-embed-body="true"]')
    expect(body).toBeInstanceOf(HTMLElement)
    expect((body as HTMLElement).style.height).toBe('388px')
  })

  it('clamps resolved canvas embed height to the document shape in note embeds', () => {
    const editor = createEditor()
    const block = {
      id: 'block-1',
      props: {
        targetKind: 'resource',
        resourceId: 'canvas-2',
        previewWidth: 300,
        previewHeight: 800,
      },
    }
    embedResourceContentState.data = {
      id: 'canvas-2',
      type: RESOURCE_TYPES.canvases,
      name: 'Nested Canvas',
    }
    render(
      <NoteEmbedBlockView
        block={block as never}
        editor={editor as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    const root = screen.getByTestId('note-embed-block')
    const body = root.querySelector('[data-note-embed-body="true"]')
    expect(body).toBeInstanceOf(HTMLElement)
    expect(body).toHaveStyle({ height: '388px' })

    fireEvent.pointerDown(root, { button: 0 })

    const handle = screen.getByRole('button', { name: 'Resize bottom selection edge' })

    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 })
    fireEvent.pointerMove(window, { clientX: 100, clientY: 900 })

    expect(root).toHaveStyle({ width: '300px' })
    expect(body).toHaveStyle({ height: '388px' })

    fireEvent.pointerUp(window)
    expect(editor.updateBlock).toHaveBeenCalledWith(block, {
      props: {
        previewWidth: 300,
        previewHeight: 388,
      },
    })
  })

  it('wraps fixed-height media and exposes only horizontal resize handles', async () => {
    const user = userEvent.setup()
    const editor = createEditor()
    const block = {
      id: 'block-1',
      props: {
        targetKind: 'externalUrl',
        url: 'https://example.com/sound.mp3',
        name: 'Sound',
        previewWidth: 300,
      },
    }
    render(
      <NoteEmbedBlockView
        block={block as never}
        editor={editor as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )

    await user.click(await screen.findByRole('button', { name: 'mock audio layout' }))

    const body = screen
      .getByTestId('note-embed-block')
      .querySelector('[data-note-embed-body="true"]')
    expect(body).toBeInstanceOf(HTMLElement)
    expect(body).toHaveStyle({ height: `${AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK}px` })

    fireEvent.pointerDown(screen.getByTestId('note-embed-block'), { button: 0 })

    expect(screen.getByRole('button', { name: 'Resize left selection edge' })).toHaveStyle({
      bottom: '0px',
      left: '-9px',
      top: '0px',
      width: '18px',
    })
    expect(screen.getByRole('button', { name: 'Resize right selection edge' })).toHaveStyle({
      bottom: '0px',
      right: '-9px',
      top: '0px',
      width: '18px',
    })
  })
})

function createContextMenuValue(): BlockNoteContextMenuContextType {
  return {
    editor: null,
    setEditor: vi.fn(),
    position: undefined,
    note: undefined,
    noteBlockId: undefined,
    isEditorTextContext: false,
    valueInlineId: undefined,
    valueInlineInstanceId: undefined,
    valueInlineEditable: false,
    openValueInline: vi.fn(),
    registerValueInlineEdit: vi.fn(() => vi.fn()),
    openMenu: openContextMenuMock,
  }
}

function createEditor() {
  return {
    extendTextSelectionToBlockBoundary: vi.fn(),
    replaceBlocks: vi.fn(),
    setTextCursorPosition: vi.fn(),
    updateBlock: vi.fn(),
  }
}

function createEditorElement(contentWidth: number) {
  const editorElement = document.createElement('div')
  const contentElement = document.createElement('div')
  Object.defineProperty(contentElement, 'clientWidth', { value: contentWidth })
  editorElement.appendChild(contentElement)
  return editorElement
}

function sidebarDragData(sidebarItemId: string) {
  return {
    sidebarItemId,
    sidebarItemIds: [sidebarItemId],
    dragPreviewItemIds: [sidebarItemId],
  }
}

async function getRegisteredElementDropTarget() {
  await waitFor(() => expect(dropTargetForElementsMock).toHaveBeenCalled())
  return dropTargetForElementsMock.mock.calls[0]![0]
}

async function executeNoteEmbedSurfaceDrop(sidebarItemId: string) {
  await executeRegisteredSurfaceDropCommand({
    command: {
      status: 'ready',
      commandId: 'surface-drop.embed-sidebar-item-in-note',
      action: 'noteEmbed',
      items: [createNote({ id: sidebarItemId as never })],
      rejectedItems: [],
      target: {
        type: EMPTY_EMBED_DROP_TYPE,
        sourceItemId: 'note-1' as never,
        embedBlockId: 'block-1',
      },
      label: 'Embed item here',
    },
    input: { clientX: 0, clientY: 0 },
    setBatchDecision: vi.fn(),
  })
}

function createDataTransfer(data: Record<string, string>): DataTransfer {
  return {
    types: Object.keys(data),
    getData: (type: string) => data[type] ?? '',
  } as unknown as DataTransfer
}
