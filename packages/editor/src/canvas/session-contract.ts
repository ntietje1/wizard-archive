import type { ResourceId } from '../resources/domain-id'
import type { Awareness } from 'y-protocols/awareness'
import type * as Y from 'yjs'

import type { CanvasDocumentEdge, CanvasDocumentNode } from './document-contract'
import type { CanvasItemWithContent } from './item-contract'

export interface CanvasCollaborationProvider {
  awareness: Awareness
  flushUpdates: () => Promise<void> | void
}

export type CanvasCollaborationCapability =
  | { status: 'available'; provider: CanvasCollaborationProvider }
  | { status: 'unsupported' }
  | { status: 'unavailable' }

export type CanvasDocumentSession =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | {
      status: 'ready'
      canvasId: ResourceId
      workspaceId: string
      canEdit: boolean
      colorMode: 'light' | 'dark'
      parentId: ResourceId | null
      collaboration: CanvasCollaborationCapability
      user: { name: string; color: string }
      doc: Y.Doc
      nodesMap: Y.Map<CanvasDocumentNode>
      edgesMap: Y.Map<CanvasDocumentEdge>
    }

export interface CanvasSessionSource {
  useCanvasDocumentSession: (canvas: CanvasItemWithContent) => CanvasDocumentSession
}
