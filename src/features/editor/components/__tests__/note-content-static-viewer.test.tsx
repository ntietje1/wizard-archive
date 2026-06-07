import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RawNoteContent } from '../raw-note-content'
import type * as BlockNoteCore from '@blocknote/core'
import type { CustomBlock } from 'shared/editor-blocks/types'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { ReactNode } from 'react'

const { blockNoteCreateMock } = vi.hoisted(() => ({
  blockNoteCreateMock: vi.fn((options: { initialContent?: Array<unknown> }) => ({
    document: options.initialContent ?? [],
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

vi.mock('@blocknote/shadcn', () => ({
  BlockNoteView: ({
    editor,
    children,
  }: {
    editor: CustomBlockNoteEditor
    children?: ReactNode
  }) => (
    <div data-testid="block-note-view">
      <div>
        {editor.document
          .flatMap((block) =>
            Array.isArray(block.content)
              ? block.content.map((item) => (item.type === 'value' ? item.props.slug : ''))
              : [],
          )
          .join(', ')}
      </div>
      {children}
    </div>
  ),
}))

describe('RawNoteContent static viewer', () => {
  it('renders inline values with a plain static editor', () => {
    render(
      <RawNoteContent
        editable={false}
        content={[
          {
            id: 'paragraph-1',
            type: 'paragraph',
            props: {},
            content: [
              {
                type: 'value',
                props: {
                  valueId: 'value-1',
                  slug: 'strength',
                  expressionSource: '16',
                },
              },
            ],
            children: [],
          } as unknown as CustomBlock,
        ]}
      />,
    )

    expect(screen.getByTestId('block-note-view')).toHaveTextContent('strength')
    const editorOptions = blockNoteCreateMock.mock.calls[0][0]
    expect(editorOptions).not.toHaveProperty('collaboration')
    expect(editorOptions).toEqual(
      expect.objectContaining({
        initialContent: expect.any(Array),
      }),
    )
  })
})
