import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NoteEmbedBlockView } from '../embed-block'
import { AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK } from '~/features/embeds/utils/embed-media'
import { clearInternalNativeDrag } from '~/features/dnd/utils/internal-native-drag'
import { getExternalUrlDropTarget } from '~/features/embeds/utils/embed-targets'
import type { EmbedMediaLayout } from '~/features/embeds/utils/embed-media'

const uploadEmbedFileMock = vi.hoisted(() => vi.fn())
const blockDragStartMock = vi.hoisted(() => vi.fn())
const blockDragEndMock = vi.hoisted(() => vi.fn())
type ElementDropTargetArgs = {
  canDrop: (args: { source: { data: Record<string, unknown> } }) => boolean
  onDrop: (args: { source: { data: Record<string, unknown> } }) => void
}
const dropTargetForElementsMock = vi.hoisted(() => vi.fn((_args: ElementDropTargetArgs) => vi.fn()))

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

vi.mock('~/features/embeds/components/embed-content', () => ({
  EmbedContent: (props: {
    target: { kind: string; url?: string; name?: string }
    mode: 'editable' | 'readonly'
    onUpload?: () => void
    onLinkExternal?: () => void
    onMediaLayout?: (layout: EmbedMediaLayout) => void
  }) => (
    <div>
      <div data-testid="shared-embed-content" data-kind={props.target.kind} data-mode={props.mode}>
        {props.target.name ?? props.target.url ?? props.target.kind}
      </div>
      <input type="range" aria-label="mock media slider" data-embed-media-control="true" />
      {props.onUpload ? <button onClick={props.onUpload}>mock upload</button> : null}
      {props.onLinkExternal ? <button onClick={props.onLinkExternal}>mock link</button> : null}
      {props.onMediaLayout ? (
        <>
          <button
            onClick={() =>
              props.onMediaLayout?.({ kind: 'intrinsicAspectRatio', aspectRatio: 16 / 9 })
            }
          >
            mock aspect ratio
          </button>
          <button
            onClick={() =>
              props.onMediaLayout?.({
                kind: 'fixedHeight',
                height: AUDIO_EMBED_PLAYER_HEIGHT_FALLBACK,
              })
            }
          >
            mock audio layout
          </button>
        </>
      ) : null}
    </div>
  ),
}))

vi.mock('~/features/embeds/hooks/use-embed-upload', () => ({
  useEmbedUpload: () => ({ uploadEmbedFile: uploadEmbedFileMock }),
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
    clearInternalNativeDrag()
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

  it('replaces stale locator props when switching target kinds', () => {
    const editor = createEditor()
    const block = {
      id: 'block-1',
      type: 'embed',
      props: {
        targetKind: 'externalUrl',
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

    const dropTargetArgs = dropTargetForElementsMock.mock.calls[0]?.[0]
    expect(dropTargetArgs).toBeDefined()

    dropTargetArgs!.onDrop({ source: { data: sidebarDragData('map-1') } })

    expect(editor.replaceBlocks).toHaveBeenCalledWith(
      [block],
      [
        {
          ...block,
          props: {
            previewWidth: 320,
            targetKind: 'sidebarItem',
            sidebarItemId: 'map-1',
          },
        },
      ],
    )
  })

  it('uploads selected files before embedding the created sidebar item', async () => {
    uploadEmbedFileMock.mockResolvedValue({ id: 'file-1' })
    const user = userEvent.setup()
    const editor = createEditor()
    const block = { id: 'block-1', type: 'embed', props: { targetKind: 'empty' } }
    const { container } = render(
      <NoteEmbedBlockView
        block={block as never}
        editor={editor as never}
        editable
        sourceNoteId={'note-1' as never}
      />,
    )
    const input = container.querySelector('input[type="file"]')
    expect(input).toBeInstanceOf(HTMLInputElement)

    await user.upload(
      input as HTMLInputElement,
      new File(['data'], 'asset.png', { type: 'image/png' }),
    )

    expect(uploadEmbedFileMock).toHaveBeenCalledWith(expect.any(File))
    expect(editor.replaceBlocks).toHaveBeenCalledWith(
      [block],
      [
        {
          ...block,
          props: {
            previewWidth: 480,
            targetKind: 'sidebarItem',
            sidebarItemId: 'file-1',
          },
        },
      ],
    )
  })

  it('accepts sidebar item drops onto the embed block but rejects self-embed drops', () => {
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

    const dropTargetArgs = dropTargetForElementsMock.mock.calls[0]?.[0]
    expect(dropTargetArgs).toBeDefined()

    expect(dropTargetArgs!.canDrop({ source: { data: sidebarDragData('note-1') } })).toBe(false)
    expect(dropTargetArgs!.canDrop({ source: { data: sidebarDragData('map-1') } })).toBe(true)

    dropTargetArgs!.onDrop({ source: { data: sidebarDragData('map-1') } })

    expect(editor.replaceBlocks).toHaveBeenCalledWith(
      [block],
      [
        {
          ...block,
          props: {
            previewWidth: 480,
            targetKind: 'sidebarItem',
            sidebarItemId: 'map-1',
          },
        },
      ],
    )
  })

  it('selects embed blocks on click and renders canvas-style resize chrome', () => {
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

    expect(screen.queryByTestId('note-embed-resize-wrapper')).not.toBeInTheDocument()
    expect(screen.getByTestId('note-embed-block')).toHaveClass('allow-motion')
    expect(screen.queryByTestId('note-embed-select-layer')).not.toBeInTheDocument()

    fireEvent.pointerDown(screen.getByTestId('note-embed-visual-surface'), { button: 0 })

    expect(editor.setTextCursorPosition).toHaveBeenCalledWith(block, 'start')
    expect(screen.queryByTestId('note-embed-select-layer')).not.toBeInTheDocument()
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

  it('lets embedded media controls handle initial pointer interaction before embed selection', async () => {
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

    const slider = await screen.findByRole('slider', { name: 'mock media slider' })

    expect(screen.queryByTestId('note-embed-select-layer')).not.toBeInTheDocument()

    fireEvent.pointerDown(slider, { button: 0 })

    expect(editor.setTextCursorPosition).not.toHaveBeenCalled()
    expect(screen.queryByTestId('note-embed-resize-wrapper')).not.toBeInTheDocument()
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

  it('does not start embed block drags from embedded media controls', async () => {
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

    const slider = await screen.findByRole('slider', { name: 'mock media slider' })

    expect(fireEvent.dragStart(slider)).toBe(false)
    expect(blockDragStartMock).not.toHaveBeenCalled()
  })

  it('does not promote media slider pointer sequences into embed block drags', async () => {
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

    const root = screen.getByTestId('note-embed-block')
    const slider = await screen.findByRole('slider', { name: 'mock media slider' })

    fireEvent.pointerDown(slider, { button: 0 })

    expect(fireEvent.dragStart(root)).toBe(false)
    expect(blockDragStartMock).not.toHaveBeenCalled()
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

    expect(
      getExternalUrlDropTarget(
        createDataTransfer({ 'text/plain': 'https://example.com/copy.png' }),
      ),
    ).toBeNull()

    fireEvent.dragEnd(screen.getByTestId('note-embed-block'))
    expect(blockDragEndMock).toHaveBeenCalled()

    expect(
      getExternalUrlDropTarget(
        createDataTransfer({ 'text/plain': 'https://example.com/copy.png' }),
      ),
    ).toEqual({
      kind: 'externalUrl',
      url: 'https://example.com/copy.png',
      name: 'copy.png',
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

    expect(screen.queryByRole('button', { name: 'Resize embed' })).not.toBeInTheDocument()

    const root = screen.getByTestId('note-embed-block')
    fireEvent.pointerDown(root, { button: 0 })

    const handle = screen.getByRole('button', { name: 'Resize right selection edge' })

    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 })
    fireEvent.pointerMove(window, { clientX: 160, clientY: 999, shiftKey: true })

    expect(root).toHaveStyle({ width: '360px' })
    expect(root.style.height).toBe('')
    expect(editor.updateBlock).not.toHaveBeenCalled()

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

  it('does not resize intrinsic-ratio embeds below the minimum body height', async () => {
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

    const root = screen.getByTestId('note-embed-block')
    const body = root.querySelector('[data-note-embed-body="true"]')
    expect(body).toBeInstanceOf(HTMLElement)
    Object.defineProperty(body, 'clientWidth', {
      configurable: true,
      value: 298,
    })

    fireEvent.pointerDown(root, { button: 0 })

    const handle = screen.getByRole('button', { name: 'Resize right selection edge' })

    fireEvent.pointerDown(handle, { clientX: 300, clientY: 100 })
    fireEvent.pointerMove(window, { clientX: 100, clientY: 100 })

    expect(root).toHaveStyle({ width: '258px' })

    fireEvent.pointerUp(window)
    expect(editor.updateBlock).toHaveBeenCalledWith(block, {
      props: {
        previewWidth: 258,
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
    expect(screen.queryByRole('button', { name: 'Resize top selection edge' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Resize bottom selection edge' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Resize top-left selection corner' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Resize bottom-right selection corner' }),
    ).toBeNull()
  })
})

function createEditor() {
  return {
    replaceBlocks: vi.fn(),
    setTextCursorPosition: vi.fn(),
    updateBlock: vi.fn(),
  }
}

function sidebarDragData(sidebarItemId: string) {
  return {
    sidebarItemId,
    sidebarItemIds: [sidebarItemId],
    sidebarDragPreviewItemIds: [sidebarItemId],
  }
}

function createDataTransfer(data: Record<string, string>): DataTransfer {
  return {
    types: Object.keys(data),
    getData: (type: string) => data[type] ?? '',
  } as unknown as DataTransfer
}
