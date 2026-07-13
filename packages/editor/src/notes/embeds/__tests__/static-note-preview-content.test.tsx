import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import type { ReactNode } from 'react'
import { createNote } from '../../../test/sidebar-item-factory'
import type { NoteBlock } from '../../document/model'
import { StaticNotePreviewContent } from '../static-note-preview-content'

vi.mock('@wizard-archive/ui/shadcn/components/scroll-area', () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

describe('StaticNotePreviewContent', () => {
  it('renders source-projected note content for read-only previews', () => {
    const visibleBlock = createParagraphBlock('visible-block', 'Visible')
    const hiddenBlock = createParagraphBlock('hidden-block', 'Hidden')
    const source = {
      getEmbeddedNoteContent: vi.fn(() => [visibleBlock]),
    }
    const note = {
      ...createNote({ name: 'Preview note' }),
      ancestors: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
      content: [visibleBlock, hiddenBlock],
    }

    render(
      <StaticNotePreviewContent
        allowInnerScroll={false}
        constrained={false}
        fillAvailableHeight={false}
        embeddedNoteContentSource={source}
        note={note}
      />,
    )

    expect(screen.getByText('Visible')).toBeInTheDocument()
    expect(screen.queryByText('Hidden')).toBeNull()
    expect(source.getEmbeddedNoteContent).toHaveBeenCalledWith(note)
  })

  it('renders lightweight readonly note blocks with the supplied readonly note source', () => {
    const note = {
      ...createNote({ name: 'Preview note' }),
      ancestors: [],
      blockMeta: {},
      blockShareAccessWarnings: [],
      content: [createParagraphBlock('body-block', 'Preview body')],
    }

    render(
      <StaticNotePreviewContent
        allowInnerScroll={false}
        constrained={false}
        fillAvailableHeight={false}
        embeddedNoteContentSource={{}}
        note={note}
      />,
    )

    expect(screen.getByText('Preview body')).toBeInTheDocument()
  })
})

function createParagraphBlock(id: string, text: string): NoteBlock {
  return {
    id,
    type: 'paragraph',
    props: {},
    content: [
      {
        type: 'text',
        text,
        styles: {},
      },
    ],
    children: [],
  } as NoteBlock
}
