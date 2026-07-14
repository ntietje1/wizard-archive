import type { ResourceId } from '../../../resources/domain-id'
import { createContext, createElement, use, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { RemoteHighlight } from '../../utils/canvas-awareness-types'
import type { CanvasDomRuntime } from '../../system/canvas-dom-runtime'
import type { CanvasViewportController } from '../../system/canvas-viewport-controller'

import type { EmbedTargetOperations } from '../../../embeds/target-operations'
import type {
  CanvasDocumentWriter,
  CanvasEditSessionState,
  CanvasHistoryController,
  CanvasNodeActions,
  CanvasSelectionController,
} from '../../tools/canvas-tool-types'
import type { CanvasCommands } from '../document/use-canvas-commands'
import type { CanvasCollaborationProvider } from '../../session-contract'
import { createCanvasToolLocalOverlayStore } from '../../stores/canvas-tool-local-overlay-store'
import type { CanvasToolLocalOverlayStore } from '../../stores/canvas-tool-local-overlay-store'
import { createCanvasToolStore } from '../../stores/canvas-tool-store'
import type { CanvasToolStore } from '../../stores/canvas-tool-store'
import type { CanvasNoteContentSources } from '../../note-content-sources'

type CanvasRuntimeProviderProps = {
  canvasId?: ResourceId | null
  canEdit: boolean
  children: ReactNode
  commands: CanvasCommands
  documentWriter: CanvasDocumentWriter
  domRuntime: CanvasDomRuntime
  editSession: CanvasEditSessionState
  history: CanvasHistoryController
  isSidebarItemEmbedRichTextEditable: (itemId: ResourceId) => boolean
  nodeActions: CanvasNodeActions
  provider?: CanvasCollaborationProvider | null
  remoteNodeHighlights: ReadonlyMap<string, RemoteHighlight>
  remoteEdgeHighlights: ReadonlyMap<string, RemoteHighlight>
  selection: CanvasSelectionController
  localOverlayStore?: CanvasToolLocalOverlayStore
  toolStore?: CanvasToolStore
  viewportController: CanvasViewportController
} & CanvasNoteContentSources

type CanvasDocumentRuntimeServices = {
  canvasId: ResourceId | null
  commands: CanvasCommands
  documentWriter: CanvasDocumentWriter
  history: CanvasHistoryController
  isSidebarItemEmbedRichTextEditable: (itemId: ResourceId) => boolean
  embedTargetOperations?: EmbedTargetOperations
  provider: CanvasCollaborationProvider | null
} & CanvasNoteContentSources

interface CanvasInteractionRuntimeServices {
  canEdit: boolean
  editSession: CanvasEditSessionState
  nodeActions: CanvasNodeActions
  selection: CanvasSelectionController
}

interface CanvasViewportRuntimeServices {
  domRuntime: CanvasDomRuntime
  viewportController: CanvasViewportController
}

interface CanvasCollaborationRuntimeServices {
  remoteNodeHighlights: ReadonlyMap<string, RemoteHighlight>
  remoteEdgeHighlights: ReadonlyMap<string, RemoteHighlight>
}

interface CanvasRuntimeServices {
  document: CanvasDocumentRuntimeServices
  interaction: CanvasInteractionRuntimeServices
  viewport: CanvasViewportRuntimeServices
  toolStore: CanvasToolStore
  localOverlayStore: CanvasToolLocalOverlayStore
  collaboration: CanvasCollaborationRuntimeServices
}

const CanvasRuntimeContext = createContext<CanvasRuntimeServices | null>(null)

CanvasRuntimeContext.displayName = 'CanvasRuntimeContext'

function useCanvasRuntimeServices(hookName: string): CanvasRuntimeServices {
  const runtime = use(CanvasRuntimeContext)
  if (runtime === null) {
    throw new Error(`${hookName} must be used within CanvasRuntimeProvider`)
  }

  return runtime
}

export function useCanvasDocumentRuntime() {
  return useCanvasRuntimeServices('useCanvasDocumentRuntime').document
}

export function useCanvasInteractionRuntime() {
  return useCanvasRuntimeServices('useCanvasInteractionRuntime').interaction
}

export function useCanvasViewportRuntime() {
  return useCanvasRuntimeServices('useCanvasViewportRuntime').viewport
}

export function useCanvasToolRuntimeStore() {
  return useCanvasRuntimeServices('useCanvasToolRuntimeStore').toolStore
}

export function useCanvasToolLocalOverlayRuntimeStore() {
  return useCanvasRuntimeServices('useCanvasToolLocalOverlayRuntimeStore').localOverlayStore
}

export function useCanvasCollaborationRuntime() {
  return useCanvasRuntimeServices('useCanvasCollaborationRuntime').collaboration
}

export function CanvasRuntimeProvider({
  canvasId = null,
  canEdit,
  children,
  commands,
  documentWriter,
  domRuntime,
  editSession,
  history,
  isSidebarItemEmbedRichTextEditable,
  noteDocumentSource,
  noteEmbeddedNoteContentSource,
  noteEmbedTargetSource,
  noteLinkCreationSource,
  noteLinkNavigationSource,
  noteLinkResolutionSource,
  notePlaybackSource,
  notePermissionSource,
  noteSharingSource,
  noteValueReferences,
  noteValueStateSource,
  noteWikiLinkSource,
  nodeActions,
  provider = null,
  remoteNodeHighlights,
  remoteEdgeHighlights,
  selection,
  localOverlayStore,
  toolStore,
  viewportController,
}: CanvasRuntimeProviderProps) {
  const [ownedToolStore] = useState(() => createCanvasToolStore())
  const [ownedLocalOverlayStore] = useState(() => createCanvasToolLocalOverlayStore())
  const runtimeToolStore = toolStore ?? ownedToolStore
  const runtimeLocalOverlayStore = localOverlayStore ?? ownedLocalOverlayStore
  const documentServices = useMemo(
    () => ({
      canvasId,
      commands,
      documentWriter,
      embedTargetOperations: noteEmbedTargetSource.embedTargetOperations,
      history,
      isSidebarItemEmbedRichTextEditable,
      noteDocumentSource,
      noteEmbeddedNoteContentSource,
      noteEmbedTargetSource,
      noteLinkCreationSource,
      noteLinkNavigationSource,
      noteLinkResolutionSource,
      notePlaybackSource,
      notePermissionSource,
      noteSharingSource,
      noteValueReferences,
      noteValueStateSource,
      noteWikiLinkSource,
      provider,
    }),
    [
      canvasId,
      commands,
      documentWriter,
      history,
      isSidebarItemEmbedRichTextEditable,
      noteDocumentSource,
      noteEmbeddedNoteContentSource,
      noteEmbedTargetSource,
      noteLinkCreationSource,
      noteLinkNavigationSource,
      noteLinkResolutionSource,
      notePlaybackSource,
      notePermissionSource,
      noteSharingSource,
      noteValueReferences,
      noteValueStateSource,
      noteWikiLinkSource,
      provider,
    ],
  )
  const interactionServices = useMemo(
    () => ({ canEdit, editSession, nodeActions, selection }),
    [canEdit, editSession, nodeActions, selection],
  )
  const viewportServices = useMemo(
    () => ({ domRuntime, viewportController }),
    [domRuntime, viewportController],
  )
  const collaborationServices = useMemo(
    () => ({ remoteNodeHighlights, remoteEdgeHighlights }),
    [remoteEdgeHighlights, remoteNodeHighlights],
  )
  const runtimeServices = useMemo(
    () => ({
      document: documentServices,
      interaction: interactionServices,
      viewport: viewportServices,
      toolStore: runtimeToolStore,
      localOverlayStore: runtimeLocalOverlayStore,
      collaboration: collaborationServices,
    }),
    [
      collaborationServices,
      documentServices,
      interactionServices,
      runtimeLocalOverlayStore,
      runtimeToolStore,
      viewportServices,
    ],
  )

  return createElement(CanvasRuntimeContext.Provider, { value: runtimeServices }, children)
}
