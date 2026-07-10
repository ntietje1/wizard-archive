import type { CanvasDocumentEdge, CanvasDocumentNode } from './document-contract'

export type EmbeddedCanvasState =
  | {
      status: 'available'
      nodes: ReadonlyArray<CanvasDocumentNode>
      edges: ReadonlyArray<CanvasDocumentEdge>
    }
  | { status: 'loading' }
  | { status: 'unavailable' }
