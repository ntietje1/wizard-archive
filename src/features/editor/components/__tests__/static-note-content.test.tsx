import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StaticNoteContent } from '../static-note-content'
import type * as BlockNoteCore from '@blocknote/core'
import type { CustomBlock } from 'shared/editor-blocks/types'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { ReactNode } from 'react'

const { blockNoteCreateMock, blockNoteViewMock } = vi.hoisted(() => ({
  blockNoteCreateMock: vi.fn((options: { initialContent?: Array<CustomBlock> }) => ({
    document: options.initialContent ?? [],
    _tiptapEditor: {
      destroy: vi.fn(),
    },
  })),
  blockNoteViewMock: vi.fn(),
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

vi.mock('@blocknote/shadcn', () => ({
  BlockNoteView: ({
    children,
    editable,
    editor,
  }: {
    children?: ReactNode
    editable: boolean
    editor: CustomBlockNoteEditor
  }) => {
    blockNoteViewMock({ editable, editor })
    return (
      <div data-testid="static-note-view">
        {editor.document
          .flatMap((block) =>
            Array.isArray(block.content)
              ? block.content.map((item) => ('text' in item ? item.text : ''))
              : [],
          )
          .join(' ')}
        {children}
      </div>
    )
  },
}))

vi.mock('~/shared/theme/context', () => ({
  useResolvedTheme: () => 'light',
}))

describe('StaticNoteContent', () => {
  beforeEach(() => {
    blockNoteCreateMock.mockClear()
    blockNoteViewMock.mockClear()
  })

  it('renders explicit blocks through a read-only local editor', async () => {
    render(
      <StaticNoteContent
        content={[
          {
            id: 'market-heading',
            type: 'heading',
            props: { level: 3 },
            content: [{ type: 'text', text: 'The Lantern Market', styles: {} }],
            children: [],
          } as CustomBlock,
        ]}
      >
        <span>Footer marker</span>
      </StaticNoteContent>,
    )

    expect(await screen.findByTestId('static-note-view')).toHaveTextContent('The Lantern Market')
    expect(screen.getByText('Footer marker')).toBeInTheDocument()
    expect(blockNoteCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialContent: expect.any(Array),
      }),
    )
    expect(blockNoteCreateMock.mock.calls[0]?.[0]).not.toHaveProperty('collaboration')
    expect(blockNoteViewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        editable: false,
      }),
    )
  })
})
