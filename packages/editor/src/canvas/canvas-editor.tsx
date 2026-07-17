import { useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { CanvasEditorSurface } from './canvas-editor-surface'
import { createCanvasDocumentController } from './document-controller'
import { createCanvasInteractionController } from './interaction-controller'
import type { CanvasSession } from '../resources/content-session-contract'
import type { CanvasDocumentNode } from './document-contract'
import type { ResourceId } from '../resources/domain-id'
import type { AuthoredDestination } from '../resources/authored-destination-contract'
import { createCanvasInteractionRenderStore } from './interaction-render-store'

type CanvasEditorProps = Readonly<{
  canEdit: boolean
  drop?: CanvasDropResolver
  renderEmbed: CanvasEmbedRenderer
  resourceId: ResourceId
  session: CanvasSession
  title: string
}>

export type CanvasDropResolver = Readonly<{
  canResolve(dataTransfer: Pick<DataTransfer, 'types'>): boolean
  resolve(
    dataTransfer: DataTransfer,
    maximumDestinations: number,
    signal: AbortSignal,
  ): Promise<ReadonlyArray<AuthoredDestination>>
}>

export type CanvasEmbedRenderer = (props: {
  editing: boolean
  node: Extract<CanvasDocumentNode, { type: 'embed' }>
  onEdit: () => void
}) => ReactNode

type CanvasEditorRuntime = Readonly<{
  documentController: ReturnType<typeof createCanvasDocumentController>
  interactionController: ReturnType<typeof createCanvasInteractionController>
  interactionRenderStore: ReturnType<typeof createCanvasInteractionRenderStore>
}>

export function CanvasEditor(props: CanvasEditorProps) {
  const [runtimeStore] = useState(() => createCanvasEditorRuntimeStore(props.session.document))
  const runtime = useSyncExternalStore(runtimeStore.subscribe, runtimeStore.get, runtimeStore.get)
  if (!runtime) return <div role="status">Loading canvas</div>
  return (
    <CanvasEditorSurface
      canEdit={props.canEdit}
      collaboration={props.session.collaboration}
      documentController={runtime.documentController}
      drop={props.drop ?? null}
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
