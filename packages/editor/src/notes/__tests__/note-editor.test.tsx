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
        editable={false}
        label="Readonly note"
        onFlush={vi.fn(() => Promise.resolve())}
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
        editable
        label="Editable note"
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
    render(
      <NoteEditor
        document={document}
        editable
        label="Value insertion note"
        onFlush={() => Promise.resolve()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Value' }))

    await waitFor(() => {
      const [block] = noteYDocToBlocks(document, NOTE_YJS_FRAGMENT)
      const value = Array.isArray(block?.content)
        ? block.content.find((inline) => inline.type === 'value')
        : undefined
      expect(value?.type).toBe('value')
      if (value?.type === 'value') expect(isUuidV7(value.props.valueId)).toBe(true)
    })
  })
})
