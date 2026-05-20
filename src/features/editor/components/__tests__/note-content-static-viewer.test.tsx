import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NoteContent } from '../note-content'
import type * as BlockNoteCore from '@blocknote/core'
import type { CustomBlock, CustomBlockNoteEditor } from 'convex/notes/editorSpecs'
import type { Id } from 'convex/_generated/dataModel'
import type { ReactNode } from 'react'

const { blockNoteCreateMock, campaignState, editorModeState } = vi.hoisted(() => ({
  blockNoteCreateMock: vi.fn((options: { initialContent?: Array<unknown> }) => ({
    document: options.initialContent ?? [],
    replaceBlocks: vi.fn(),
    _tiptapEditor: {
      destroy: vi.fn(),
    },
  })),
  campaignState: { isDm: true },
  editorModeState: { viewAsPlayerId: undefined as Id<'campaignMembers'> | undefined },
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

vi.mock('../note-view', () => ({
  NoteView: ({ editor, children }: { editor: CustomBlockNoteEditor; children?: ReactNode }) => (
    <div data-testid="note-view">
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

vi.mock('../extensions/link-click-handler', () => ({
  LinkClickHandler: () => null,
}))

vi.mock('~/features/editor/hooks/useLinkResolver', () => ({
  useLinkResolver: () => ({
    isViewerMode: true,
    resolveLink: vi.fn(),
  }),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => campaignState,
}))

vi.mock('~/features/sidebar/hooks/useEditorMode', () => ({
  useEditorMode: () => editorModeState,
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => ({
    itemsMap: new Map(),
  }),
}))

describe('NoteContent static viewer', () => {
  it('renders inline values with a plain static editor', () => {
    render(
      <NoteContent
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

    expect(screen.getByTestId('note-view')).toHaveTextContent('strength')
    const editorOptions = blockNoteCreateMock.mock.calls[0][0]
    expect(editorOptions).not.toHaveProperty('collaboration')
    expect(editorOptions).toEqual(
      expect.objectContaining({
        initialContent: expect.any(Array),
      }),
    )
  })
})
