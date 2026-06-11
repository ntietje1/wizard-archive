import type * as Y from 'yjs'
import type { CanvasWithContent } from 'shared/canvases/types'
import type { ConvexYjsProvider } from '~/shared/collaboration/convex-yjs-provider'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '~/features/canvas/domain/canvas-document'

export type CanvasDocumentSource =
  | { status: 'loading' }
  | { status: 'error'; error: Error | string }
  | {
      status: 'ready'
      canvasId: CanvasWithContent['_id']
      campaignId: CanvasWithContent['campaignId']
      canEdit: boolean
      colorMode: 'light' | 'dark'
      parentId: CanvasWithContent['parentId']
      provider: ConvexYjsProvider | null
      user: { name: string; color: string }
      doc: Y.Doc
      nodesMap: Y.Map<CanvasDocumentNode>
      edgesMap: Y.Map<CanvasDocumentEdge>
    }

export type ReadyCanvasDocumentSource = Extract<CanvasDocumentSource, { status: 'ready' }>
