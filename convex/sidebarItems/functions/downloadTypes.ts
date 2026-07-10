import type { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type {
  CanvasDocumentEdge,
  CanvasDocumentNode,
} from '@wizard-archive/editor/canvas/document-contract'
import type { NoteBlock } from '@wizard-archive/editor/notes/document-contract'

export interface CanvasDownloadContent {
  edges: Array<CanvasDocumentEdge>
  nodes: Array<CanvasDocumentNode>
}

/**
 * A downloadable sidebar artifact. `downloadUrl` is nullable for binary-backed
 * items when no file is attached or a signed URL cannot be generated; consumers
 * must skip or report those entries instead of fetching blindly.
 */
export type DownloadItem =
  | {
      type: typeof RESOURCE_TYPES.files | typeof RESOURCE_TYPES.gameMaps
      name: string
      path: string
      downloadUrl: string | null
    }
  | {
      type: typeof RESOURCE_TYPES.notes
      name: string
      path: string
      content: Array<NoteBlock>
    }
  | {
      type: typeof RESOURCE_TYPES.canvases
      name: string
      path: string
      content: CanvasDownloadContent
    }
