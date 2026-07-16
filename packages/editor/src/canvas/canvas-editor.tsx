import { useState, useSyncExternalStore } from 'react'
import { CanvasEditorSurface } from './canvas-editor-surface'
import { createCanvasDocumentController } from './document-controller'
import { createCanvasInteractionController } from './interaction-controller'
import type { CanvasSession } from '../resources/content-session-contract'
import type { ResourceId } from '../resources/domain-id'

type CanvasEditorProps = Readonly<{
  canEdit: boolean
  resourceId: ResourceId
  session: CanvasSession
  title: string
}>

type CanvasEditorRuntime = Readonly<{
  documentController: ReturnType<typeof createCanvasDocumentController>
  interactionController: ReturnType<typeof createCanvasInteractionController>
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
      interactionController={runtime.interactionController}
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
      runtime = {
        documentController,
        interactionController: createCanvasInteractionController({
          readContent: () => documentController.read(),
        }),
      }
      listener()
    }
    return () => {
      listeners.delete(listener)
      if (listeners.size > 0 || !runtime) return
      runtime.interactionController.dispose()
      runtime.documentController.dispose()
      runtime = null
    }
  }
  return { get, subscribe }
}
