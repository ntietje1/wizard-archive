import * as Y from 'yjs'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HistoryPreviewViewer } from '../history-preview-viewer'
import type * as BlockNoteCore from '@blocknote/core'
import type { Id } from 'convex/_generated/dataModel'

const { canvasReadOnlyPreviewMock, noteContentMock, useCampaignQueryMock } = vi.hoisted(() => ({
  canvasReadOnlyPreviewMock: vi.fn(),
  noteContentMock: vi.fn(),
  useCampaignQueryMock: vi.fn(),
}))
const canvasPreviewEmbedNodeMock = vi.hoisted(() => vi.fn())

vi.mock('@blocknote/core', async (importOriginal) => {
  const actual = await importOriginal<typeof BlockNoteCore>()
  return {
    ...actual,
    BlockNoteEditor: {
      create: vi.fn(() => ({})),
    },
  }
})

vi.mock('shared/editor-blocks/blocknote-yjs', () => ({
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

vi.mock('~/features/canvas/components/canvas-read-only-preview', () => ({
  CanvasReadOnlyPreview: (props: unknown) => {
    canvasReadOnlyPreviewMock(props)
    return <div data-testid="canvas-preview" />
  },
}))

vi.mock('~/features/canvas/components/canvas-preview-embed-node', () => ({
  CanvasPreviewEmbedNode: canvasPreviewEmbedNodeMock,
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
  beforeEach(() => {
    canvasReadOnlyPreviewMock.mockClear()
    noteContentMock.mockClear()
    useCampaignQueryMock.mockReset()
  })

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

    render(<HistoryPreviewViewer itemId={noteId} entryId={'history-1' as Id<'editHistory'>} />)

    expect(screen.getByTestId('note-content')).toBeInTheDocument()
    expect(noteContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        noteId,
        editable: false,
      }),
    )
  })

  it('shows a corrupted state for invalid note snapshots', () => {
    useCampaignQueryMock
      .mockReturnValueOnce({
        data: {
          itemId: 'note-1',
          itemType: 'note',
          snapshotType: 'yjs_state',
          data: new Uint8Array([1]).buffer,
        },
        isLoading: false,
        error: null,
      })
      .mockReturnValueOnce({
        data: { _creationTime: 1 },
        isLoading: false,
        error: null,
      })

    render(
      <HistoryPreviewViewer
        itemId={'note-1' as Id<'sidebarItems'>}
        entryId={'history-1' as Id<'editHistory'>}
      />,
    )

    expect(screen.getByText('Snapshot data is corrupted.')).toBeInTheDocument()
    expect(noteContentMock).not.toHaveBeenCalled()
  })

  it('shows a corrupted state for invalid canvas snapshots', () => {
    useCampaignQueryMock
      .mockReturnValueOnce({
        data: {
          itemId: 'canvas-1',
          itemType: 'canvas',
          snapshotType: 'yjs_state',
          data: new Uint8Array([1]).buffer,
        },
        isLoading: false,
        error: null,
      })
      .mockReturnValueOnce({
        data: { _creationTime: 1 },
        isLoading: false,
        error: null,
      })

    render(
      <HistoryPreviewViewer
        itemId={'canvas-1' as Id<'sidebarItems'>}
        entryId={'history-1' as Id<'editHistory'>}
      />,
    )

    expect(screen.getByText('Snapshot data is corrupted.')).toBeInTheDocument()
    expect(canvasReadOnlyPreviewMock).not.toHaveBeenCalled()
  })

  it('passes the sidebar-backed embed renderer into canvas snapshot previews', () => {
    const canvasId = 'canvas-1' as Id<'sidebarItems'>
    const doc = new Y.Doc()
    doc.getMap('nodes').set('embed-1', {
      id: 'embed-1',
      type: 'embed',
      position: { x: 0, y: 0 },
      data: { sidebarItemId: 'note-1' },
    })
    const snapshotData = Y.encodeStateAsUpdate(doc).buffer
    doc.destroy()
    useCampaignQueryMock
      .mockReturnValueOnce({
        data: {
          itemId: canvasId,
          itemType: 'canvas',
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

    render(<HistoryPreviewViewer itemId={canvasId} entryId={'history-1' as Id<'editHistory'>} />)

    expect(screen.getByTestId('canvas-preview')).toBeInTheDocument()
    expect(canvasReadOnlyPreviewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        interactive: true,
        embedRenderer: canvasPreviewEmbedNodeMock,
        nodes: [
          {
            id: 'embed-1',
            type: 'embed',
            position: { x: 0, y: 0 },
            data: { sidebarItemId: 'note-1' },
          },
        ],
        edges: [],
      }),
    )
  })
})
