import type { CanvasWithContent } from 'shared/canvases/types'
import type { ComponentType, ReactNode } from 'react'
import type {
  CanvasDocumentSource,
  ReadyCanvasDocumentSource,
} from '../runtime/session/canvas-document-source'
import type { CanvasContextMenuSource } from '../runtime/context-menu/canvas-context-menu-types'
import type { EmbeddedCanvasStateResolver } from '~/features/embeds/context/embedded-canvas-state-resolution'
import type { EmbeddedMapStateResolver } from '~/features/embeds/context/embedded-map-state-resolution'
import type { EmbedSidebarItemResolver } from '~/features/embeds/context/embed-sidebar-item-resolution'

export interface CanvasViewerSource {
  SourceComponent: ComponentType<CanvasViewerSourceComponentProps>
  RuntimeComponent: ComponentType<CanvasViewerRuntimeProps>
  EmbeddedCanvasStateResolver?: EmbeddedCanvasStateResolver
  EmbeddedMapStateResolver?: EmbeddedMapStateResolver
  EmbedTargetOperationsSource?: ComponentType<{ children: ReactNode }>
  SidebarItemEmbedResolver?: EmbedSidebarItemResolver
}

export interface CanvasViewerRuntimeProps {
  contextMenuSource: CanvasContextMenuSource | undefined
  session: ReadyCanvasDocumentSource
  source: CanvasViewerSource
}

export interface CanvasViewerSourceComponentProps {
  canvas: CanvasWithContent
  source: CanvasViewerSource
}

export interface CanvasViewerSessionProps {
  contextMenuSource: CanvasContextMenuSource | undefined
  session: CanvasDocumentSource
  source: CanvasViewerSource
}
