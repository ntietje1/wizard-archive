import * as Y from 'yjs'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HistoryPreviewViewer } from '../history-preview-viewer'
import { LiveHistoryPreviewViewer } from '../live-history-preview-viewer'
import type * as BlockNoteCore from '@blocknote/core'
import type * as BlockNoteReact from '@blocknote/react'
import type { Id } from 'convex/_generated/dataModel'
import type { ReactNode } from 'react'

const { canvasReadOnlyPreviewMock, rawNoteContentMock, useCampaignQueryMock } = vi.hoisted(() => ({
  canvasReadOnlyPreviewMock: vi.fn(),
  rawNoteContentMock: vi.fn(),
  useCampaignQueryMock: vi.fn(),
}))
const canvasPreviewEmbedNodeMock = vi.hoisted(() => vi.fn())

vi.mock('convex/_generated/api', () => ({
  api: {
    documentSnapshots: {
      queries: {
        getSnapshotForHistoryEntry: 'getSnapshotForHistoryEntry',
      },
    },
    editHistory: {
      queries: {
        getHistoryEntry: 'getHistoryEntry',
      },
    },
    storage: {
      queries: {
        getDownloadUrl: 'getDownloadUrl',
      },
    },
  },
}))

vi.mock('@blocknote/core', async (importOriginal) => {
  const actual = await importOriginal<typeof BlockNoteCore>()
  return {
    ...actual,
    BlockNoteEditor: {
      create: vi.fn((options: { initialContent?: Array<unknown> }) => ({
        document: options.initialContent ?? [],
        getExtension: vi.fn(() => undefined),
        replaceBlocks: vi.fn(),
        _tiptapEditor: {
          destroy: vi.fn(),
        },
      })),
    },
  }
})

vi.mock('@blocknote/react', async (importOriginal) => {
  const actual = await importOriginal<typeof BlockNoteReact>()
  return {
    ...actual,
    BlockNoteViewRaw: ({ children }: { children?: ReactNode }) => (
      <div data-testid="block-note-view">{children}</div>
    ),
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

vi.mock('~/features/editor/components/raw-note-content-with-embeds', () => ({
  RawNoteContentWithEmbeds: (props: unknown) => {
    rawNoteContentMock(props)
    return <div data-testid="raw-note-content" />
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

function encodeSnapshot(doc: Y.Doc): ArrayBuffer {
  const update = Y.encodeStateAsUpdate(doc)
  const copy = new Uint8Array(update.byteLength)
  copy.set(update)
  return copy.buffer as ArrayBuffer
}

describe('HistoryPreviewViewer', () => {
  beforeEach(() => {
    canvasReadOnlyPreviewMock.mockClear()
    rawNoteContentMock.mockClear()
    useCampaignQueryMock.mockReset()
  })

  it('passes the snapshot note id into static note previews', () => {
    const noteId = 'note-1' as Id<'sidebarItems'>
    const doc = new Y.Doc()
    const snapshotData = encodeSnapshot(doc)
    doc.destroy()

    render(
      <HistoryPreviewViewer
        canEdit
        onExit={vi.fn()}
        onRestore={vi.fn()}
        state={{
          status: 'ready',
          entryTime: 1,
          snapshot: { kind: 'note-yjs', noteId, data: snapshotData },
        }}
      />,
    )

    expect(screen.getByTestId('raw-note-content')).toBeInTheDocument()
    expect(rawNoteContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        noteId,
        editable: false,
      }),
    )
  })

  it('shows a corrupted state for invalid note snapshots', () => {
    render(
      <HistoryPreviewViewer
        canEdit
        onExit={vi.fn()}
        onRestore={vi.fn()}
        state={{
          status: 'ready',
          entryTime: 1,
          snapshot: {
            kind: 'note-yjs',
            noteId: 'note-1' as Id<'sidebarItems'>,
            data: new Uint8Array([1]).buffer,
          },
        }}
      />,
    )

    expect(screen.getByText('Snapshot data is corrupted.')).toBeInTheDocument()
    expect(rawNoteContentMock).not.toHaveBeenCalled()
  })

  it('shows a corrupted state for invalid canvas snapshots', () => {
    render(
      <HistoryPreviewViewer
        canEdit
        onExit={vi.fn()}
        onRestore={vi.fn()}
        state={{
          status: 'ready',
          entryTime: 1,
          snapshot: {
            kind: 'canvas-yjs',
            canvasId: 'canvas-1' as Id<'sidebarItems'>,
            data: new Uint8Array([1]).buffer,
          },
        }}
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
    const snapshotData = encodeSnapshot(doc)
    doc.destroy()

    render(
      <HistoryPreviewViewer
        canEdit
        onExit={vi.fn()}
        onRestore={vi.fn()}
        state={{
          status: 'ready',
          entryTime: 1,
          snapshot: { kind: 'canvas-yjs', canvasId, data: snapshotData },
        }}
      />,
    )

    expect(screen.getByTestId('canvas-preview')).toBeInTheDocument()
    expect(canvasReadOnlyPreviewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        interactive: true,
        embedRenderer: canvasPreviewEmbedNodeMock,
        sourceItemId: canvasId,
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

  it('loads snapshot and history entry through the live source wrapper', () => {
    const noteId = 'note-1' as Id<'sidebarItems'>
    const entryId = 'history-1' as Id<'editHistory'>
    const doc = new Y.Doc()
    const snapshotData = encodeSnapshot(doc)
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

    render(<LiveHistoryPreviewViewer itemId={noteId} entryId={entryId} />)

    expect(screen.getByTestId('raw-note-content')).toBeInTheDocument()
    expect(useCampaignQueryMock).toHaveBeenNthCalledWith(1, 'getSnapshotForHistoryEntry', {
      editHistoryId: entryId,
    })
    expect(useCampaignQueryMock).toHaveBeenNthCalledWith(2, 'getHistoryEntry', {
      editHistoryId: entryId,
    })
  })
})
