import type { ResourceId } from '../../resources/domain-id'
import type { CanvasDocumentSession, CanvasSessionSource } from '../session-contract'
import type { MapItemWithContent } from '../../game-maps/item-contract'

import type { CanvasContextMenuSource } from '../runtime/context-menu/canvas-context-menu-types'
import type { EmbeddedMapState } from '../../game-maps/embedded-state-contract'
import type { PreviewUploadCapability } from '../../files/preview-upload-contract'
import type { CanvasViewportStore } from '../runtime/interaction/canvas-viewport-storage'
import type { CanvasNoteContentSources } from '../note-content-sources'

export interface CanvasViewerContentSource extends CanvasSessionSource, CanvasNoteContentSources {
  embedResolution: {
    resolveEmbeddedMapState: (map: MapItemWithContent) => EmbeddedMapState
  }
  isSidebarItemEmbedRichTextEditable: (itemId: ResourceId) => boolean
  previewUpload: PreviewUploadCapability
  viewportStore: CanvasViewportStore
  resolveContextMenuSource: (
    input: CanvasViewerContextMenuSourceInput,
  ) => CanvasContextMenuSource | undefined
}

interface CanvasViewerContextMenuSourceInput {
  session: CanvasDocumentSession
}
