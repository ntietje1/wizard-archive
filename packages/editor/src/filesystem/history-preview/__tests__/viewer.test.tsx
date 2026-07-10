import * as Y from 'yjs'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { HistoryPreviewViewer } from '../viewer'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { createNoteYDocFromContent } from '../../../notes/imported-text'
import type * as ImportedTextModule from '../../../notes/imported-text'
import { createCanvasDocumentDoc } from '../../../canvas/document-contract'
import { RESOURCE_TYPES } from '../../../workspace/items-persistence-contract'

const { canvasReadOnlyPreviewMock, readNoteYDocContentMock, staticNoteContentMock } = vi.hoisted(
  () => ({
    canvasReadOnlyPreviewMock: vi.fn(),
    readNoteYDocContentMock: vi.fn(),
    staticNoteContentMock: vi.fn(),
  }),
)

vi.mock('../../../notes/imported-text', async (importOriginal) => {
  const actual = await importOriginal<typeof ImportedTextModule>()
  readNoteYDocContentMock.mockImplementation(actual.readNoteYDocContent)

  return {
    ...actual,
    readNoteYDocContent: readNoteYDocContentMock,
  }
})

vi.mock('../../../notes/static-content', () => ({
  StaticNoteContent: (props: unknown) => {
    staticNoteContentMock(props)
    return <div data-testid="static-note-content" />
  },
}))

vi.mock('../../../canvas/preview/read-only-preview', () => ({
  CanvasReadOnlyPreview: (props: unknown) => {
    canvasReadOnlyPreviewMock(props)
    return <div data-testid="canvas-preview" />
  },
}))

function encodeSnapshot(doc: Y.Doc): ArrayBuffer {
  const update = Y.encodeStateAsUpdate(doc)
  const copy = new Uint8Array(update.byteLength)
  copy.set(update)
  return copy.buffer as ArrayBuffer
}

describe('HistoryPreviewViewer', () => {
  it('keeps history preview actions visible while a snapshot is loading', () => {
    render(
      <HistoryPreviewViewer
        canEdit
        onExit={vi.fn()}
        onRestore={vi.fn()}
        state={{
          status: 'loading',
          entryTime: 1,
        }}
      />,
    )

    expect(screen.getByText(/Previewing version/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Exit' })).toBeInTheDocument()
  })

  it('passes the snapshot note id into static note previews', () => {
    const noteId = 'note-1' as SidebarItemId
    const doc = createNoteYDocFromContent([
      {
        id: 'block-1',
        type: 'paragraph',
        props: {},
        content: [],
        children: [],
      },
    ])
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

    expect(screen.getByTestId('static-note-content')).toBeInTheDocument()
    expect(staticNoteContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        noteId,
      }),
    )
  })

  it('reuses decoded note snapshots while the snapshot data is stable', () => {
    const noteId = 'note-1' as SidebarItemId
    const doc = createNoteYDocFromContent([
      {
        id: 'block-1',
        type: 'paragraph',
        props: {},
        content: [],
        children: [],
      },
    ])
    const snapshotData = encodeSnapshot(doc)
    doc.destroy()
    readNoteYDocContentMock.mockClear()
    const state = {
      status: 'ready',
      entryTime: 1,
      snapshot: { kind: 'note-yjs', noteId, data: snapshotData },
    } as const

    const view = render(
      <HistoryPreviewViewer canEdit onExit={vi.fn()} onRestore={vi.fn()} state={state} />,
    )
    view.rerender(
      <HistoryPreviewViewer canEdit onExit={vi.fn()} onRestore={vi.fn()} state={state} />,
    )

    expect(readNoteYDocContentMock).toHaveBeenCalledTimes(1)
  })

  it('passes sidebar-backed canvas nodes into canvas snapshot previews', () => {
    const canvasId = 'canvas-1' as SidebarItemId
    const noteId = 'note-1' as SidebarItemId
    const doc = createCanvasDocumentDoc({
      nodes: [
        {
          id: 'embed-1',
          type: 'embed',
          position: { x: 0, y: 0 },
          data: { target: { kind: 'resource', resourceId: noteId } },
        },
      ],
      edges: [],
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
        sourceItemId: canvasId,
        nodes: [
          {
            id: 'embed-1',
            type: 'embed',
            position: { x: 0, y: 0 },
            data: { target: { kind: 'resource', resourceId: noteId } },
          },
        ],
        edges: [],
      }),
    )
  })

  it('renders stored game map snapshots with the historical image and pins', () => {
    render(
      <HistoryPreviewViewer
        canEdit
        onExit={vi.fn()}
        onRestore={vi.fn()}
        state={{
          status: 'ready',
          entryTime: 1,
          snapshot: {
            kind: 'game-map',
            imageUrlState: { status: 'ready', url: 'https://example.com/map.png' },
            snapshotData: {
              imageAssetId: 'storage-1',
              pins: [
                {
                  itemId: 'note-1' as SidebarItemId,
                  x: 12,
                  y: 34,
                  visible: true,
                  name: 'Hidden Shrine',
                  color: '#cc8844',
                  iconName: 'MapPin',
                  itemType: RESOURCE_TYPES.notes,
                },
              ],
            },
          },
        }}
      />,
    )

    expect(screen.getByAltText('Map preview')).toHaveAttribute('src', 'https://example.com/map.png')
  })

  it('treats pending game map image URLs as loading instead of failed', () => {
    render(
      <HistoryPreviewViewer
        canEdit
        onExit={vi.fn()}
        onRestore={vi.fn()}
        state={{
          status: 'ready',
          entryTime: 1,
          snapshot: {
            kind: 'game-map',
            imageUrlState: { status: 'idle' },
            snapshotData: {
              imageAssetId: 'storage-1',
              pins: [],
            },
          },
        }}
      />,
    )

    expect(screen.getByText('Loading map image.')).toBeInTheDocument()
  })

  it('shows the unsupported fallback for rejected snapshot content', () => {
    render(
      <HistoryPreviewViewer
        canEdit
        onExit={vi.fn()}
        onRestore={vi.fn()}
        state={{
          status: 'ready',
          entryTime: 1,
          snapshot: { kind: 'unsupported' },
        }}
      />,
    )

    expect(screen.getByText('Preview not available for this snapshot type.')).toBeInTheDocument()
  })
})
