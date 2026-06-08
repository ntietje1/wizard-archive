import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NoteEmbedBlockView } from '../embed-block'

const uploadEmbedFileMock = vi.hoisted(() => vi.fn())
type ElementDropTargetArgs = {
  canDrop: (args: { source: { data: Record<string, unknown> } }) => boolean
  onDrop: (args: { source: { data: Record<string, unknown> } }) => void
}
const dropTargetForElementsMock = vi.hoisted(() => vi.fn((_args: ElementDropTargetArgs) => vi.fn()))

vi.mock('~/features/embeds/components/embed-content', () => ({
  EmbedContent: (props: {
    target: { kind: string; url?: string; name?: string }
    mode: 'editable' | 'readonly'
    onUpload?: () => void
    onLinkExternal?: () => void
    onIntrinsicAspectRatio?: (aspectRatio: number | null) => void
  }) => (
    <div>
      <div data-testid="shared-embed-content" data-kind={props.target.kind} data-mode={props.mode}>
        {props.target.name ?? props.target.url ?? props.target.kind}
      </div>
      {props.onUpload ? <button onClick={props.onUpload}>mock upload</button> : null}
      {props.onLinkExternal ? <button onClick={props.onLinkExternal}>mock link</button> : null}
      {props.onIntrinsicAspectRatio ? (
        <button onClick={() => props.onIntrinsicAspectRatio?.(16 / 9)}>mock aspect ratio</button>
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
    dropTargetForElementsMock.mockClear()
    dropTargetForElementsMock.mockReturnValue(vi.fn())
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

    dropTargetArgs!.onDrop({ source: { data: { sidebarItemId: 'map-1' } } })

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

    expect(dropTargetArgs!.canDrop({ source: { data: { sidebarItemId: 'note-1' } } })).toBe(false)
    expect(dropTargetArgs!.canDrop({ source: { data: { sidebarItemId: 'map-1' } } })).toBe(true)

    dropTargetArgs!.onDrop({ source: { data: { sidebarItemId: 'map-1' } } })

    expect(editor.replaceBlocks).toHaveBeenCalledWith(
      [block],
      [
        {
          ...block,
          props: {
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
    expect(screen.getByTestId('note-embed-select-layer')).toBeInTheDocument()

    fireEvent.pointerDown(screen.getByTestId('note-embed-select-layer'), { button: 0 })

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
    expect(screen.queryAllByTestId(/note-embed-resize-zone-/)).toHaveLength(8)
    expect(screen.getByRole('button', { name: 'Resize top selection edge' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Resize bottom-right selection corner' }),
    ).toBeInTheDocument()
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
})

function createEditor() {
  return {
    replaceBlocks: vi.fn(),
    setTextCursorPosition: vi.fn(),
    updateBlock: vi.fn(),
  }
}
