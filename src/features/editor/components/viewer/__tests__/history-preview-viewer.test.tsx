import * as Y from 'yjs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HistoryPreviewViewer } from '../history-preview-viewer'
import type * as BlockNoteCore from '@blocknote/core'
import type { Id } from 'convex/_generated/dataModel'

const { noteContentMock, useCampaignQueryMock } = vi.hoisted(() => ({
  noteContentMock: vi.fn(),
  useCampaignQueryMock: vi.fn(),
}))

vi.mock('@blocknote/core', async (importOriginal) => {
  const actual = await importOriginal<typeof BlockNoteCore>()
  return {
    ...actual,
    BlockNoteEditor: {
      create: vi.fn(() => ({})),
    },
  }
})

vi.mock('@blocknote/core/yjs', () => ({
  yDocToBlocks: vi.fn(() => [
    {
      id: 'block-1',
      type: 'paragraph',
      props: {},
      content: [],
      children: [],
    },
  ]),
}))

vi.mock('../history-preview-banner', () => ({
  HistoryPreviewBanner: () => <div data-testid="history-preview-banner" />,
}))

vi.mock('~/features/editor/components/note-content', () => ({
  NoteContent: (props: unknown) => {
    noteContentMock(props)
    return <div data-testid="note-content" />
  },
}))

vi.mock('~/features/sidebar/hooks/useEditorMode', () => ({
  useEditorMode: () => ({ canEdit: true }),
}))

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: (...args: Array<unknown>) => useCampaignQueryMock(...args),
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: () => ({ data: null, isLoading: false }),
}))

vi.mock('~/features/editor/utils/destroy-blocknote-editor', () => ({
  destroyBlockNoteEditor: vi.fn(),
}))

describe('HistoryPreviewViewer', () => {
  it('passes the snapshot note id into static note previews', () => {
    const noteId = 'note-1' as Id<'sidebarItems'>
    const doc = new Y.Doc()
    const snapshotData = Y.encodeStateAsUpdate(doc).buffer
    doc.destroy()
    useCampaignQueryMock
      .mockReturnValueOnce({
        data: {
          itemId: noteId,
          itemType: 'note',
          snapshotType: 'yjs_state',
          data: snapshotData,
        },
        isLoading: false,
        error: null,
      })
      .mockReturnValueOnce({
        data: { _creationTime: 1 },
        isLoading: false,
        error: null,
      })

    render(<HistoryPreviewViewer entryId={'history-1' as Id<'editHistory'>} />)

    expect(screen.getByTestId('note-content')).toBeInTheDocument()
    expect(noteContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        noteId,
        editable: false,
      }),
    )
  })
})
