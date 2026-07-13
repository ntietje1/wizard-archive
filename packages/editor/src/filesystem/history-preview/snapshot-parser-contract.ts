import type { CanvasDocumentEdge, CanvasDocumentNode } from '../../canvas/document-contract'
import type { NoteBlock } from '../../notes/document/model'

export type HistorySnapshotParserRequest =
  | { kind: 'note-yjs'; data: ArrayBuffer }
  | { kind: 'canvas-yjs'; data: ArrayBuffer }

export type HistorySnapshotParserResult =
  | { status: 'ready'; kind: 'note-yjs'; value: Array<NoteBlock> }
  | {
      status: 'ready'
      kind: 'canvas-yjs'
      value: { nodes: Array<CanvasDocumentNode>; edges: Array<CanvasDocumentEdge> }
    }
  | { status: 'corrupted' }
