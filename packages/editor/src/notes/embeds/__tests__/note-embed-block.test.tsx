import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import {
  EMPTY_AUTHORED_DESTINATION_SERIALIZED,
  parseSerializedAuthoredDestination,
  serializeAuthoredDestination,
} from '../../../resources/authored-destination'
import { parseSafeHttpsUrl } from '../../../resources/authored-destination-contract'
import { DOMAIN_ID_KIND, generateDomainId } from '../../../resources/domain-id'
import { NoteEmbedBlock } from '../note-embed-block'
import { NoteEmbedRuntimeProvider } from '../note-embed-runtime'
import { createEmbedItem } from '../../slash-menu/embed-slash-menu'

describe('NoteEmbedBlock', () => {
  it('stores external links as canonical authored destinations', () => {
    const editor = { updateBlock: vi.fn() }
    renderNoteEmbed(editor, EMPTY_AUTHORED_DESTINATION_SERIALIZED)

    fireEvent.click(screen.getByRole('button', { name: 'or link to an external file' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'External file URL' }), {
      target: { value: 'https://example.com/maps/harbor.png' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Link' }))

    const update = editor.updateBlock.mock.calls[0]?.[1]
    expect(parseSerializedAuthoredDestination(update.props.destination)).toEqual({
      kind: 'externalUrl',
      url: parseSafeHttpsUrl('https://example.com/maps/harbor.png'),
    })
  })

  it('renders external images with the pre-cutover link and media treatment', () => {
    const url = parseSafeHttpsUrl('https://example.com/maps/harbor.png')
    if (!url) throw new Error('Expected a safe URL')
    renderNoteEmbed(
      { updateBlock: vi.fn() },
      serializeAuthoredDestination({ kind: 'externalUrl', url }),
      false,
    )

    expect(screen.getByRole('link', { name: 'harbor.png' })).toHaveAttribute('href', url)
    expect(screen.getByRole('img', { name: 'harbor.png' })).toHaveAttribute('src', url)
  })

  it('uses the shared drop resolver and rejects recursive resource destinations', async () => {
    const sourceResourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const editor = { updateBlock: vi.fn() }
    const resolver = {
      canResolve: vi.fn(() => true),
      resolveFiles: vi.fn(() => Promise.resolve([])),
      resolve: vi.fn(() =>
        Promise.resolve([
          {
            kind: 'internal' as const,
            target: { kind: 'resource' as const, resourceId: sourceResourceId },
          },
        ]),
      ),
    }
    render(
      <NoteEmbedRuntimeProvider
        binding={{
          drop: resolver,
          renderNote: () => null,
          runtime: {} as never,
          sourceResourceId,
        }}
        editable
      >
        <NoteEmbedBlock
          block={embedBlock(EMPTY_AUTHORED_DESTINATION_SERIALIZED) as never}
          contentRef={() => {}}
          editor={editor as never}
        />
      </NoteEmbedRuntimeProvider>,
    )
    const dataTransfer = { types: ['application/x-test'] }

    fireEvent.dragOver(screen.getByTestId('note-embed-block'), { dataTransfer })
    fireEvent.drop(screen.getByTestId('note-embed-block'), { dataTransfer })

    await waitFor(() => expect(resolver.resolve).toHaveBeenCalledOnce())
    expect(editor.updateBlock).not.toHaveBeenCalled()
  })

  it('keeps the upload button pending until canonical file creation settles', async () => {
    const sourceResourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const targetResourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const editor = { updateBlock: vi.fn() }
    let settle: (
      destinations: ReadonlyArray<{
        kind: 'internal'
        target: { kind: 'resource'; resourceId: typeof targetResourceId }
      }>,
    ) => void = () => {}
    const resolver = {
      canResolve: vi.fn(() => true),
      resolve: vi.fn(() => Promise.resolve([])),
      resolveFiles: vi.fn(
        () =>
          new Promise<
            ReadonlyArray<{
              kind: 'internal'
              target: { kind: 'resource'; resourceId: typeof targetResourceId }
            }>
          >((resolve) => {
            settle = resolve
          }),
      ),
    }
    const { container } = render(
      <NoteEmbedRuntimeProvider
        binding={{
          drop: resolver,
          renderNote: () => null,
          runtime: {} as never,
          sourceResourceId,
        }}
        editable
      >
        <NoteEmbedBlock
          block={embedBlock(EMPTY_AUTHORED_DESTINATION_SERIALIZED) as never}
          contentRef={() => {}}
          editor={editor as never}
        />
      </NoteEmbedRuntimeProvider>,
    )
    const file = new File(['map'], 'map.png', { type: 'image/png' })
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    if (!input) throw new Error('Expected a file input')

    fireEvent.change(input, { target: { files: [file] } })

    expect(screen.getByRole('button', { name: 'Uploading' })).toBeDisabled()
    expect(resolver.resolveFiles).toHaveBeenCalledWith([file], 1, expect.any(AbortSignal))

    settle([
      {
        kind: 'internal',
        target: { kind: 'resource', resourceId: targetResourceId },
      },
    ])
    await waitFor(() => expect(editor.updateBlock).toHaveBeenCalledOnce())
  })
})

describe('createEmbedItem', () => {
  it('replaces an empty slash paragraph with one canonical empty embed', () => {
    const paragraph = { id: generateDomainId(DOMAIN_ID_KIND.noteBlock), type: 'paragraph' }
    const editor = {
      focus: vi.fn(),
      getTextCursorPosition: () => ({ block: paragraph }),
      insertBlocks: vi.fn(),
      replaceBlocks: vi.fn(),
    }

    createEmbedItem(editor as never).onItemClick()

    expect(editor.replaceBlocks).toHaveBeenCalledWith(
      [paragraph],
      [
        {
          type: 'embed',
          props: {
            destination: EMPTY_AUTHORED_DESTINATION_SERIALIZED,
            previewWidth: 480,
          },
        },
      ],
    )
    expect(editor.insertBlocks).not.toHaveBeenCalled()
    expect(editor.focus).toHaveBeenCalledOnce()
  })
})

function renderNoteEmbed(
  editor: { updateBlock: ReturnType<typeof vi.fn> },
  destination: string,
  editable = true,
) {
  return render(
    <NoteEmbedRuntimeProvider editable={editable}>
      <NoteEmbedBlock
        block={embedBlock(destination) as never}
        contentRef={() => {}}
        editor={editor as never}
      />
    </NoteEmbedRuntimeProvider>,
  )
}

function embedBlock(destination: string) {
  return {
    id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
    type: 'embed',
    props: {
      destination,
      backgroundColor: 'default',
      textAlignment: 'left',
      previewWidth: 480,
    },
    children: [],
  }
}
