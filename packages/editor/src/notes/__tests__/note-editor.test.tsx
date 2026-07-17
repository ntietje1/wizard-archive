import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BlockNoteEditor } from '@blocknote/core'
import { describe, expect, it, vi } from 'vite-plus/test'
import {
  DOMAIN_ID_KIND,
  generateDomainId,
  generateUuidV7,
  isUuidV7,
} from '../../resources/domain-id'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc, noteYDocToBlocks } from '../document/headless-yjs'
import { NoteEditor } from '../note-editor'
import { EPHEMERAL_NOTE_SCROLL } from '../note-scroll-persistence'
import { insertNoteValueFromSlashMenu } from '../slash-menu/value-slash-menu'

describe('NoteEditor', () => {
  it('renders the canonical document fragment in read-only mode', async () => {
    const document = noteBlocksToYDoc(
      [
        {
          id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
          type: 'heading',
          props: { level: 2 },
          content: [{ type: 'text', text: 'Canonical heading' }],
        },
        {
          id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
          type: 'paragraph',
          content: [{ type: 'text', text: 'Canonical body' }],
        },
      ],
      NOTE_YJS_FRAGMENT,
    )

    const { unmount } = render(
      <NoteEditor
        document={document}
        label="Readonly note"
        mode="view"
        scroll={EPHEMERAL_NOTE_SCROLL}
      />,
    )

    expect(await screen.findByRole('textbox', { name: 'Readonly note' })).toHaveTextContent(
      'Canonical headingCanonical body',
    )
    expect(screen.getByRole('textbox', { name: 'Readonly note' })).toHaveAttribute(
      'contenteditable',
      'false',
    )
    unmount()
  })

  it('renders remote document updates in view mode', async () => {
    const document = noteBlocksToYDoc([{ type: 'paragraph' }], NOTE_YJS_FRAGMENT)
    const createEditor = vi.spyOn(BlockNoteEditor, 'create')
    render(
      <>
        <NoteEditor
          document={document}
          label="Live viewer"
          mode="view"
          scroll={EPHEMERAL_NOTE_SCROLL}
        />
        <NoteEditor
          document={document}
          label="Remote editor"
          mode="edit"
          persistence="initializing"
          scroll={EPHEMERAL_NOTE_SCROLL}
        />
      </>,
    )

    insertValueWithLatestEditor(createEditor)

    expect(await screen.findByRole('textbox', { name: 'Live viewer' })).toHaveTextContent('Value0')
    createEditor.mockRestore()
  })

  it('switches presentation mode without recreating the editor or document', async () => {
    const document = noteBlocksToYDoc(
      [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'One canonical document' }],
        },
      ],
      NOTE_YJS_FRAGMENT,
    )
    const flush = vi.fn(() => Promise.resolve())
    const createEditor = vi.spyOn(BlockNoteEditor, 'create')
    const view = render(
      <NoteEditor
        document={document}
        label="Mode-switching note"
        mode="edit"
        persistence="ready"
        scroll={EPHEMERAL_NOTE_SCROLL}
        onFlush={flush}
      />,
    )
    const editor = await screen.findByRole('textbox', { name: 'Mode-switching note' })
    const creationCount = createEditor.mock.calls.length

    view.rerender(
      <NoteEditor
        document={document}
        label="Mode-switching note"
        mode="view"
        scroll={EPHEMERAL_NOTE_SCROLL}
      />,
    )

    expect(editor).toHaveAttribute('contenteditable', 'false')
    expect(editor).toHaveTextContent('One canonical document')
    expect(createEditor).toHaveBeenCalledTimes(creationCount)
    expect(flush).toHaveBeenCalledOnce()
    createEditor.mockRestore()
  })

  it('edits UUID-backed value labels and formulas in the canonical document', async () => {
    const valueId = generateUuidV7()
    const document = noteBlocksToYDoc(
      [
        {
          id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
          type: 'paragraph',
          content: [{ type: 'value', props: { valueId, label: 'Health', expressionSource: '10' } }],
        },
      ],
      NOTE_YJS_FRAGMENT,
    )
    render(
      <NoteEditor
        document={document}
        label="Editable note"
        mode="edit"
        persistence="ready"
        scroll={EPHEMERAL_NOTE_SCROLL}
        onFlush={() => Promise.resolve()}
      />,
    )
    const createEditor = vi.spyOn(BlockNoteEditor, 'create')

    fireEvent.click(await screen.findByRole('button', { name: 'Health: 10' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Value label' }), {
      target: { value: 'Hit points' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Value formula' }), {
      target: { value: '6 * 3' },
    })

    expect(await screen.findByRole('button', { name: 'Hit points: 18' })).toBeInTheDocument()
    expect(createEditor).not.toHaveBeenCalled()
    createEditor.mockRestore()
    await waitFor(() => {
      const [block] = noteYDocToBlocks(document, NOTE_YJS_FRAGMENT)
      expect(block?.content).toEqual([
        {
          type: 'value',
          props: { valueId, label: 'Hit points', expressionSource: '6 * 3' },
        },
      ])
    })
  })

  it('inserts new values with UUIDv7 identities', async () => {
    const document = noteBlocksToYDoc(
      [
        {
          id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
          type: 'paragraph',
          content: [{ type: 'text', text: 'Stats ' }],
        },
      ],
      NOTE_YJS_FRAGMENT,
    )
    const createEditor = vi.spyOn(BlockNoteEditor, 'create')
    render(
      <NoteEditor
        document={document}
        label="Value insertion note"
        mode="edit"
        persistence="ready"
        scroll={EPHEMERAL_NOTE_SCROLL}
        onFlush={() => Promise.resolve()}
      />,
    )

    insertValueWithLatestEditor(createEditor)

    await waitFor(() => {
      const [block] = noteYDocToBlocks(document, NOTE_YJS_FRAGMENT)
      const value = Array.isArray(block?.content)
        ? block.content.find((inline) => inline.type === 'value')
        : undefined
      expect(value?.type).toBe('value')
      if (value?.type === 'value') expect(isUuidV7(value.props.valueId)).toBe(true)
    })
    createEditor.mockRestore()
  })

  it('creates canonical block identities through native keyboard commands', async () => {
    const document = noteBlocksToYDoc([{ type: 'paragraph' }], NOTE_YJS_FRAGMENT)
    render(
      <NoteEditor
        document={document}
        label="Block identity note"
        mode="edit"
        persistence="ready"
        scroll={EPHEMERAL_NOTE_SCROLL}
        onFlush={() => Promise.resolve()}
      />,
    )

    const textbox = await screen.findByRole('textbox', { name: 'Block identity note' })
    fireEvent.click(textbox)
    fireEvent.keyDown(textbox, { key: 'Enter' })

    await waitFor(() => {
      const blocks = noteYDocToBlocks(document, NOTE_YJS_FRAGMENT)
      expect(blocks).toHaveLength(2)
      expect(blocks.every((block) => isUuidV7(block.id))).toBe(true)
    })
  })

  it('tracks canonical document edits in native editor history', async () => {
    const document = noteBlocksToYDoc(
      [
        {
          id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
          type: 'paragraph',
          content: [],
        },
      ],
      NOTE_YJS_FRAGMENT,
    )
    const createEditor = vi.spyOn(BlockNoteEditor, 'create')
    render(
      <NoteEditor
        document={document}
        label="History note"
        mode="edit"
        persistence="ready"
        scroll={EPHEMERAL_NOTE_SCROLL}
        onFlush={() => Promise.resolve()}
      />,
    )
    const textbox = await screen.findByRole('textbox', { name: 'History note' })
    insertValueWithLatestEditor(createEditor)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Value: 0' })).toBeInTheDocument(),
    )
    fireEvent.keyDown(textbox, {
      key: 'z',
      ctrlKey: true,
    })
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Value: 0' })).not.toBeInTheDocument(),
    )
    fireEvent.keyDown(textbox, {
      key: 'z',
      ctrlKey: true,
      shiftKey: true,
    })
    expect(await screen.findByRole('button', { name: 'Value: 0' })).toBeInTheDocument()
    createEditor.mockRestore()
  })

  it('stops external file drops without intercepting rich internal transfers', () => {
    const document = noteBlocksToYDoc(
      [
        {
          id: generateDomainId(DOMAIN_ID_KIND.noteBlock),
          type: 'paragraph',
          content: [{ type: 'text', text: 'Drop target' }],
        },
      ],
      NOTE_YJS_FRAGMENT,
    )
    render(
      <NoteEditor
        document={document}
        label="Drop-protected note"
        mode="edit"
        persistence="ready"
        scroll={EPHEMERAL_NOTE_SCROLL}
        onFlush={() => Promise.resolve()}
      />,
    )
    const textbox = screen.getByRole('textbox', { name: 'Drop-protected note' })
    const surface = textbox.closest('.resource-note-editor')
    if (!(surface instanceof HTMLElement)) throw new Error('Expected note editor surface')
    const received = vi.fn()
    surface.addEventListener('drop', received)

    fireEvent.drop(surface, {
      dataTransfer: { files: [new File(['content'], 'outside.txt')], types: ['Files'] },
    })
    expect(received).not.toHaveBeenCalled()

    fireEvent.drop(surface, { dataTransfer: { files: [], types: ['text/html'] } })
    expect(received).toHaveBeenCalledOnce()
  })
})

function insertValueWithLatestEditor(createEditor: ReturnType<typeof vi.spyOn>) {
  const editor = createEditor.mock.results.at(-1)?.value
  if (!editor) throw new Error('Expected a BlockNote editor')
  editor.focus()
  insertNoteValueFromSlashMenu(editor)
}
