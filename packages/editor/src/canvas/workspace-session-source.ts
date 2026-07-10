import type { SidebarItemId } from '../../../../shared/common/ids'
import type { EmbeddedCanvasState } from './embedded-state-contract'
import type { CanvasItemWithContent } from './item-contract'
import type { CanvasDocumentSession, CanvasSessionSource } from './session-contract'

export interface CanvasSessionPorts {
  document: CanvasSessionSource
}

export interface CanvasEmbeddedSessionPorts {
  embeddedCanvas: CanvasEmbeddedCanvasSource
}

interface CanvasEmbeddedCanvasSource {
  useEmbeddedCanvasState: (canvasId: SidebarItemId) => EmbeddedCanvasState
}

interface CanvasDocumentSessionCapability {
  useCanvasDocumentSession: (input: {
    canEdit: boolean
    canvas: CanvasItemWithContent
  }) => CanvasDocumentSession
}

interface CanvasEmbeddedCanvasCapability {
  useEmbeddedCanvasState: (canvasId: SidebarItemId) => EmbeddedCanvasState
}

interface CanvasSessionAccessCapability {
  canEditCanvas: (canvas: CanvasItemWithContent) => boolean
}

interface CanvasSessionPortsInput {
  access: CanvasSessionAccessCapability
  documentSession: CanvasDocumentSessionCapability
}

interface CanvasEmbeddedSessionPortsInput {
  embeddedCanvas: CanvasEmbeddedCanvasCapability
}

// react-doctor-disable-next-line deslop/unused-export -- Public package export consumed through adapter subpaths.
export function createCanvasSessionPorts({
  access,
  documentSession,
}: CanvasSessionPortsInput): CanvasSessionPorts {
  return {
    document: {
      useCanvasDocumentSession: (canvas) =>
        documentSession.useCanvasDocumentSession({
          canEdit: access.canEditCanvas(canvas),
          canvas,
        }),
    },
  }
}

// react-doctor-disable-next-line deslop/unused-export -- Public package export consumed through adapter subpaths.
export function createCanvasEmbeddedSessionPorts({
  embeddedCanvas,
}: CanvasEmbeddedSessionPortsInput): CanvasEmbeddedSessionPorts {
  return {
    embeddedCanvas: {
      useEmbeddedCanvasState: embeddedCanvas.useEmbeddedCanvasState,
    },
  }
}
