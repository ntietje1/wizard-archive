import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { CanvasEditorSurface } from './canvas-editor-surface'
import { createCanvasDocumentController } from './document-controller'
import { createCanvasInteractionController } from './interaction-controller'
import type { CanvasSession } from '../resources/content-session-contract'
import type { CanvasDocumentNode } from './document-contract'
import type { CanvasNodeId, ResourceId } from '../resources/domain-id'
import type { AuthoredDestinationDropResolver } from '../resources/authored-destination-drop'
import type { AuthoredDestination } from '../resources/authored-destination-contract'
import { createCanvasInteractionRenderStore } from './interaction-render-store'
import type { BlockNoteActivation } from '../rich-text/blocknote/use-blocknote-activation'
import type { ResourcePreviewPublicationGateway } from '../resources/editor-runtime-contract'

type CanvasEditorProps = Readonly<{
  canEdit: boolean
  drop?: AuthoredDestinationDropResolver
  focusedNodeId?: CanvasNodeId | null
  openDestination?: (destination: AuthoredDestination) => void
  previewPublication?: ResourcePreviewPublicationGateway
  renderEmbed: CanvasEmbedRenderer
  resourceId: ResourceId
  session: CanvasSession
  title: string
}>

export type CanvasEmbedRenderer = (props: {
  activation: BlockNoteActivation | null
  editing: boolean
  node: Extract<CanvasDocumentNode, { type: 'embed' }>
  zoom: number
}) => ReactNode

type CanvasEditorRuntime = Readonly<{
  documentController: ReturnType<typeof createCanvasDocumentController>
  interactionController: ReturnType<typeof createCanvasInteractionController>
  interactionRenderStore: ReturnType<typeof createCanvasInteractionRenderStore>
}>

export function CanvasEditor(props: CanvasEditorProps) {
  useEffect(() => props.session.retain(), [props.session])
  const [runtimeStore] = useState(() => createCanvasEditorRuntimeStore(props.session.document))
  const runtime = useSyncExternalStore(runtimeStore.subscribe, runtimeStore.get, runtimeStore.get)
  if (!runtime) return <div role="status">Loading canvas</div>
  return (
    <CanvasEditorSurface
      canEdit={props.canEdit}
      collaboration={props.session.collaboration}
      document={props.session.document}
      documentController={runtime.documentController}
      drop={props.drop ?? null}
      focusedNodeId={props.focusedNodeId ?? null}
      openDestination={props.openDestination ?? null}
      previewPublication={
        props.previewPublication
          ? {
              gateway: props.previewPublication,
              prepare: props.session.flush,
              resourceId: props.resourceId,
            }
          : null
      }
      interactionController={runtime.interactionController}
      interactionRenderStore={runtime.interactionRenderStore}
      renderEmbed={props.renderEmbed}
      resourceId={props.resourceId}
      title={props.title}
    />
  )
}

function createCanvasEditorRuntimeStore(document: CanvasSession['document']) {
  let runtime: CanvasEditorRuntime | null = null
  const listeners = new Set<() => void>()
  const get = () => runtime
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    if (!runtime) {
      const documentController = createCanvasDocumentController(document)
      const interactionController = createCanvasInteractionController({
        readContent: () => documentController.read(),
      })
      runtime = {
        documentController,
        interactionController,
        interactionRenderStore: createCanvasInteractionRenderStore(interactionController),
      }
      listener()
    }
    return () => {
      listeners.delete(listener)
      if (listeners.size > 0 || !runtime) return
      runtime.interactionRenderStore.dispose()
      runtime.interactionController.dispose()
      runtime.documentController.dispose()
      runtime = null
    }
  }
  return { get, subscribe }
}
