import { render, screen } from '@testing-library/react'
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
  }) => (
    <div>
      <div data-testid="shared-embed-content" data-kind={props.target.kind} data-mode={props.mode}>
        {props.target.name ?? props.target.url ?? props.target.kind}
      </div>
      {props.onUpload ? <button onClick={props.onUpload}>mock upload</button> : null}
      {props.onLinkExternal ? <button onClick={props.onLinkExternal}>mock link</button> : null}
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
        contentRef={null}
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
        contentRef={null}
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
        contentRef={null}
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
        contentRef={null}
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
            previewHeight: 200,
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
        contentRef={null}
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
        contentRef={null}
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

  it('resizes embed blocks by patching primitive preview dimensions', async () => {
    const editor = createEditor()
    const block = {
      id: 'block-1',
      props: {
        targetKind: 'externalUrl',
        url: 'https://example.com/map.png',
        name: 'Map',
        previewWidth: 300,
        previewHeight: 200,
      },
    }
    render(
      <NoteEmbedBlockView
        block={block as never}
        editor={editor as never}
        editable
        sourceNoteId={'note-1' as never}
        contentRef={null}
      />,
    )

    const handle = screen.getByRole('button', { name: 'Resize embed' })
    await userEvent.pointer([
      { keys: '[MouseLeft>]', target: handle, coords: { x: 100, y: 100 } },
      { coords: { x: 160, y: 125 } },
      { keys: '[/MouseLeft]', coords: { x: 160, y: 125 } },
    ])

    expect(editor.updateBlock).toHaveBeenCalledWith(block, {
      props: {
        previewWidth: 360,
        previewHeight: 225,
      },
    })
  })
})

function createEditor() {
  return {
    replaceBlocks: vi.fn(),
    updateBlock: vi.fn(),
  }
}
