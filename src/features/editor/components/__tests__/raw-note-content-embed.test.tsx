import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RawNoteContentWithEmbeds } from '../raw-note-content-with-embeds'
import type * as BlockNoteCore from '@blocknote/core'
import type * as BlockNoteReact from '@blocknote/react'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { ReactNode } from 'react'

const { blockNoteCreateMock } = vi.hoisted(() => ({
  blockNoteCreateMock: vi.fn((options: { initialContent?: Array<unknown> }) => ({
    document: options.initialContent ?? [],
    getExtension: vi.fn(() => undefined),
    replaceBlocks: vi.fn(),
    _tiptapEditor: {
      destroy: vi.fn(),
    },
  })),
}))

vi.mock('@blocknote/core', async (importOriginal) => {
  const actual = await importOriginal<typeof BlockNoteCore>()
  return {
    ...actual,
    BlockNoteEditor: {
      create: blockNoteCreateMock,
    },
  }
})

vi.mock('@blocknote/react', async (importOriginal) => {
  const actual = await importOriginal<typeof BlockNoteReact>()
  return {
    ...actual,
    BlockNoteViewRaw: ({
      editor,
      children,
    }: {
      editor: CustomBlockNoteEditor
      children?: ReactNode
    }) => (
      <div>
        {editor.document.map((block) => {
          if (block.type !== 'embed') return null
          return (
            <div data-testid="raw-note-embed" key={block.id}>
              {block.props.url ?? block.props.targetKind}
            </div>
          )
        })}
        {children}
      </div>
    ),
  }
})

vi.mock('~/features/embeds/components/embed-content', () => ({
  EmbedContent: (props: { target: { kind: string; url?: string } }) => (
    <div data-testid="raw-note-embed">{props.target.url ?? props.target.kind}</div>
  ),
}))

describe('RawNoteContent embeds', () => {
  it('renders embed blocks through the note embed renderer in static mode', async () => {
    render(
      <RawNoteContentWithEmbeds
        editable={false}
        content={
          [
            {
              id: 'embed-1',
              type: 'embed',
              props: {
                targetKind: 'externalUrl',
                url: 'https://example.com/file.pdf',
                name: 'file.pdf',
                textAlignment: 'left',
                backgroundColor: 'default',
              },
              content: undefined,
              children: [],
            },
          ] as never
        }
      />,
    )

    expect(await screen.findByTestId('raw-note-embed')).toHaveTextContent(
      'https://example.com/file.pdf',
    )
  })
})
