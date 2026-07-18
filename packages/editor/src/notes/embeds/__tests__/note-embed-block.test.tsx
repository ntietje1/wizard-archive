import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import * as Y from 'yjs'
import {
  EMPTY_AUTHORED_DESTINATION_SERIALIZED,
  parseSerializedAuthoredDestination,
  serializeAuthoredDestination,
} from '../../../resources/authored-destination'
import { parseSafeHttpsUrl } from '../../../resources/authored-destination-contract'
import { DOMAIN_ID_KIND, generateDomainId } from '../../../resources/domain-id'
import { NoteEmbedBlock } from '../note-embed-block'
import { NoteResourceRuntimeProvider } from '../../note-resource-runtime'
import { createEmbedItem } from '../../slash-menu/embed-slash-menu'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc, noteYDocToBlocks } from '../../document/headless-yjs'

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

  it('renders malformed percent escapes without changing the canonical external href', () => {
    const url = parseSafeHttpsUrl('https://example.com/maps/truncated%E0%A4%A.png?raw=1#preview')
    if (!url) throw new Error('Expected a safe URL')

    expect(() =>
      renderNoteEmbed(
        { updateBlock: vi.fn() },
        serializeAuthoredDestination({ kind: 'externalUrl', url }),
        false,
      ),
    ).not.toThrow()

    expect(screen.getByRole('link', { name: 'truncated%E0%A4%A.png' })).toHaveAttribute('href', url)
    expect(screen.getByRole('img', { name: 'truncated%E0%A4%A.png' })).toHaveAttribute('src', url)
  })

  it('selects resolved embeds and restores keyboard-accessible resize handles', () => {
    const url = parseSafeHttpsUrl('https://example.com/maps/harbor.png')
    if (!url) throw new Error('Expected a safe URL')
    const editor = {
      domElement: null,
      setTextCursorPosition: vi.fn(),
      updateBlock: vi.fn(),
    }
    renderNoteEmbed(editor, serializeAuthoredDestination({ kind: 'externalUrl', url }), true)

    fireEvent.pointerDown(screen.getByTestId('note-embed-block'), { button: 0 })

    expect(editor.setTextCursorPosition).toHaveBeenCalledOnce()
    expect(screen.getAllByTestId(/note-embed-resize-zone-/)).toHaveLength(8)

    fireEvent.keyDown(screen.getByRole('button', { name: 'Resize embedded resource right' }), {
      key: 'ArrowRight',
    })

    expect(editor.updateBlock).toHaveBeenLastCalledWith(expect.anything(), {
      props: { previewHeight: 144, previewWidth: 496 },
    })
  })

  it('does not expose resize controls in a readonly note', () => {
    const url = parseSafeHttpsUrl('https://example.com/maps/harbor.png')
    if (!url) throw new Error('Expected a safe URL')
    renderNoteEmbed(
      {
        domElement: null,
        setTextCursorPosition: vi.fn(),
        updateBlock: vi.fn(),
      },
      serializeAuthoredDestination({ kind: 'externalUrl', url }),
      false,
    )

    fireEvent.pointerDown(screen.getByTestId('note-embed-block'), { button: 0 })

    expect(screen.queryByTestId('note-embed-resize-wrapper')).not.toBeInTheDocument()
  })

  it('commits pointer resize geometry to the canonical embed props', () => {
    const url = parseSafeHttpsUrl('https://example.com/maps/harbor.png')
    if (!url) throw new Error('Expected a safe URL')
    const editor = {
      domElement: null,
      setTextCursorPosition: vi.fn(),
      updateBlock: vi.fn(),
    }
    renderNoteEmbed(editor, serializeAuthoredDestination({ kind: 'externalUrl', url }), true)
    const root = screen.getByTestId('note-embed-block')
    const body = root.querySelector<HTMLElement>('[data-note-embed-body="true"]')
    if (!body) throw new Error('Expected an embed body')
    vi.spyOn(root, 'getBoundingClientRect').mockReturnValue(rect(480, 328))
    vi.spyOn(body, 'getBoundingClientRect').mockReturnValue(rect(480, 288))
    fireEvent.pointerDown(root, { button: 0 })

    fireEvent.pointerDown(
      screen.getByRole('button', { name: 'Resize embedded resource bottom right' }),
      {
        clientX: 480,
        clientY: 288,
        pointerId: 1,
      },
    )
    fireEvent.pointerMove(window, { clientX: 520, clientY: 312, pointerId: 1 })
    fireEvent.pointerUp(window, { pointerId: 1 })

    expect(editor.updateBlock).toHaveBeenLastCalledWith(expect.anything(), {
      props: { previewHeight: 312, previewWidth: 520 },
    })
  })

  it('uses the shared drop resolver and rejects recursive resource destinations', async () => {
    const sourceResourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const editor = { updateBlock: vi.fn() }
    const resolver = {
      canResolve: vi.fn(() => true),
      resolveFiles: vi.fn(() =>
        Promise.resolve({ kind: 'destinations' as const, destinations: [] }),
      ),
      resolve: vi.fn(() =>
        Promise.resolve({
          kind: 'destinations' as const,
          destinations: [
            {
              kind: 'internal' as const,
              target: { kind: 'resource' as const, resourceId: sourceResourceId },
            },
          ],
        }),
      ),
    }
    render(
      <NoteResourceRuntimeProvider
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
      </NoteResourceRuntimeProvider>,
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
    const blockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const document = noteBlocksToYDoc(
      [embedBlock(EMPTY_AUTHORED_DESTINATION_SERIALIZED, blockId)],
      NOTE_YJS_FRAGMENT,
    )
    let settle: (result: {
      kind: 'resourceCreations'
      settlements: [{ status: 'completed'; resourceId: typeof targetResourceId }]
    }) => void = () => {}
    const resolver = {
      canResolve: vi.fn(() => true),
      resolve: vi.fn(() => Promise.resolve({ kind: 'destinations' as const, destinations: [] })),
      resolveFiles: vi.fn(
        () =>
          new Promise<{
            kind: 'resourceCreations'
            settlements: [{ status: 'completed'; resourceId: typeof targetResourceId }]
          }>((resolve) => {
            settle = resolve
          }),
      ),
    }
    const { container } = render(
      <NoteResourceRuntimeProvider
        binding={{
          drop: resolver,
          renderNote: () => null,
          runtime: {} as never,
          sourceResourceId,
        }}
        document={document}
        editable
      >
        <NoteEmbedBlock
          block={embedBlock(EMPTY_AUTHORED_DESTINATION_SERIALIZED, blockId) as never}
          contentRef={() => {}}
          editor={editor as never}
        />
      </NoteResourceRuntimeProvider>,
    )
    const file = new File(['map'], 'map.png', { type: 'image/png' })
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    if (!input) throw new Error('Expected a file input')

    fireEvent.change(input, { target: { files: [file] } })

    expect(screen.getByRole('button', { name: 'Uploading' })).toBeDisabled()
    expect(resolver.resolveFiles).toHaveBeenCalledWith([file], 1, expect.any(AbortSignal))

    settle({
      kind: 'resourceCreations',
      settlements: [{ status: 'completed', resourceId: targetResourceId }],
    })
    await waitFor(() => {
      const inserted = noteYDocToBlocks(document, NOTE_YJS_FRAGMENT)[0]
      expect(inserted?.type).toBe('embed')
      expect(
        parseSerializedAuthoredDestination(
          inserted?.type === 'embed' ? inserted.props.destination : '',
        ),
      ).toEqual({
        kind: 'internal',
        target: { kind: 'resource', resourceId: targetResourceId },
      })
    })
    expect(editor.updateBlock).not.toHaveBeenCalled()
  })

  it('retries an indeterminate creation receipt without creating another resource', async () => {
    const sourceResourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const targetResourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const blockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const document = noteBlocksToYDoc(
      [embedBlock(EMPTY_AUTHORED_DESTINATION_SERIALIZED, blockId)],
      NOTE_YJS_FRAGMENT,
    )
    const retryCreation = vi.fn(() =>
      Promise.resolve({ status: 'completed' as const, resourceId: targetResourceId }),
    )
    const report = vi.fn()
    const resolver = {
      canResolve: vi.fn(() => true),
      resolve: vi.fn(() => Promise.resolve({ kind: 'destinations' as const, destinations: [] })),
      resolveFiles: vi.fn(() =>
        Promise.resolve({
          kind: 'resourceCreations' as const,
          settlements: [
            {
              status: 'indeterminate' as const,
              reason: 'response_lost' as const,
              retry: retryCreation,
            },
          ],
        }),
      ),
    }
    const { container } = render(
      <NoteResourceRuntimeProvider
        binding={{
          drop: resolver,
          report,
          renderNote: () => null,
          runtime: {} as never,
          sourceResourceId,
        }}
        document={document}
        editable
      >
        <NoteEmbedBlock
          block={embedBlock(EMPTY_AUTHORED_DESTINATION_SERIALIZED, blockId) as never}
          contentRef={() => {}}
          editor={{ updateBlock: vi.fn() } as never}
        />
      </NoteResourceRuntimeProvider>,
    )
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    if (!input) throw new Error('Expected a file input')

    fireEvent.change(input, {
      target: { files: [new File(['map'], 'map.png', { type: 'image/png' })] },
    })

    await waitFor(() =>
      expect(report).toHaveBeenCalledWith('File creation status is unknown', expect.any(Function)),
    )
    const retry = report.mock.calls.at(-1)?.[1]
    if (!retry) throw new Error('Expected a creation retry')
    retry()

    await waitFor(() => expect(retryCreation).toHaveBeenCalledOnce())
    await waitFor(() => {
      const inserted = noteYDocToBlocks(document, NOTE_YJS_FRAGMENT)[0]
      expect(
        inserted?.type === 'embed'
          ? parseSerializedAuthoredDestination(inserted.props.destination)
          : null,
      ).toEqual({
        kind: 'internal',
        target: { kind: 'resource', resourceId: targetResourceId },
      })
    })
  })

  it('reports creation after target unmount and retries insertion exactly once', async () => {
    const sourceResourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const targetResourceId = generateDomainId(DOMAIN_ID_KIND.resource)
    const blockId = generateDomainId(DOMAIN_ID_KIND.noteBlock)
    const document = noteBlocksToYDoc(
      [
        embedBlock(EMPTY_AUTHORED_DESTINATION_SERIALIZED, blockId),
        {
          type: 'paragraph' as const,
          content: [{ type: 'text' as const, text: 'Retained' }],
        },
      ],
      NOTE_YJS_FRAGMENT,
    )
    let settle: (result: {
      kind: 'resourceCreations'
      settlements: [{ status: 'completed'; resourceId: typeof targetResourceId }]
    }) => void = () => {}
    const report = vi.fn()
    const resolver = {
      canResolve: vi.fn(() => true),
      resolve: vi.fn(() => Promise.resolve({ kind: 'destinations' as const, destinations: [] })),
      resolveFiles: vi.fn(
        () =>
          new Promise<{
            kind: 'resourceCreations'
            settlements: [{ status: 'completed'; resourceId: typeof targetResourceId }]
          }>((resolve) => {
            settle = resolve
          }),
      ),
    }
    const runtime = {
      content: {
        notes: {
          get: () => ({
            status: 'initializing' as const,
            operationId: generateDomainId(DOMAIN_ID_KIND.operation),
            local: document,
          }),
        },
      },
    }
    const view = render(
      <NoteResourceRuntimeProvider
        binding={{
          drop: resolver,
          report,
          renderNote: () => null,
          runtime: runtime as never,
          sourceResourceId,
        }}
        document={document}
        editable
      >
        <NoteEmbedBlock
          block={embedBlock(EMPTY_AUTHORED_DESTINATION_SERIALIZED, blockId) as never}
          contentRef={() => {}}
          editor={{ updateBlock: vi.fn() } as never}
        />
      </NoteResourceRuntimeProvider>,
    )
    const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')
    if (!input) throw new Error('Expected a file input')
    fireEvent.change(input, {
      target: { files: [new File(['map'], 'map.png', { type: 'image/png' })] },
    })
    removeNoteBlock(document, blockId)
    view.unmount()

    settle({
      kind: 'resourceCreations',
      settlements: [{ status: 'completed', resourceId: targetResourceId }],
    })

    await waitFor(() =>
      expect(report).toHaveBeenCalledWith(
        'Resource created, insertion failed',
        expect.any(Function),
      ),
    )
    const retry = report.mock.calls.at(-1)?.[1]
    if (!retry) throw new Error('Expected an insertion retry')
    retry()
    retry()

    const recovered = noteYDocToBlocks(document, NOTE_YJS_FRAGMENT).filter(
      (block) =>
        block.type === 'embed' &&
        parseSerializedAuthoredDestination(block.props.destination)?.kind === 'internal',
    )
    expect(recovered).toHaveLength(1)
    expect(report).toHaveBeenLastCalledWith('Resource inserted')
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
  editor: {
    domElement?: HTMLElement | null
    setTextCursorPosition?: ReturnType<typeof vi.fn>
    updateBlock: ReturnType<typeof vi.fn>
  },
  destination: string,
  editable = true,
) {
  return render(
    <NoteResourceRuntimeProvider editable={editable}>
      <NoteEmbedBlock
        block={embedBlock(destination) as never}
        contentRef={() => {}}
        editor={editor as never}
      />
    </NoteResourceRuntimeProvider>,
  )
}

function embedBlock(destination: string, id = generateDomainId(DOMAIN_ID_KIND.noteBlock)) {
  return {
    id,
    type: 'embed' as const,
    props: {
      destination,
      backgroundColor: 'default',
      textAlignment: 'left' as const,
      previewWidth: 480,
    },
    children: [],
  }
}

function removeNoteBlock(document: Y.Doc, blockId: string) {
  const root = document.getXmlFragment(NOTE_YJS_FRAGMENT).toArray()[0]
  if (!(root instanceof Y.XmlElement)) throw new Error('Expected a note block group')
  const index = root
    .toArray()
    .findIndex((child) => child instanceof Y.XmlElement && child.getAttribute('id') === blockId)
  if (index < 0) throw new Error('Expected the note block')
  document.transact(() => root.delete(index, 1))
}

function rect(width: number, height: number): DOMRect {
  return {
    bottom: height,
    height,
    left: 0,
    right: width,
    top: 0,
    width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }
}
