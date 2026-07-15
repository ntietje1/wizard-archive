import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { DOMAIN_ID_KIND, generateDomainId } from '../../resources/domain-id'
import { NOTE_YJS_FRAGMENT, noteBlocksToYDoc } from '../document/headless-yjs'
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
})
