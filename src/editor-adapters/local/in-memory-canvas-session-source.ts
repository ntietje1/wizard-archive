import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { useEffect, useRef } from 'react'

import {
  createWizardEditorCanvasDocumentDoc,
  createWizardEditorCanvasEmbeddedSessionPorts,
  createWizardEditorCanvasSessionPorts,
  readWizardEditorCanvasDocumentContent,
  useWizardEditorCanvasDocumentSession,
} from '@wizard-archive/editor/adapter'
import type {
  WizardEditorCanvasEmbeddedSessionPorts,
  WizardEditorCanvasSessionPorts,
  WizardEditorEmbeddedCanvasState,
} from '@wizard-archive/editor/adapter'

type StaticCanvasDocumentPayload = Pick<
  Extract<WizardEditorEmbeddedCanvasState, { status: 'available' }>,
  'edges' | 'nodes'
>
type CanvasContentChangeHandler = (input: {
  canvasId: ResourceId
  payload: StaticCanvasDocumentPayload
}) => void

export function useInMemoryCanvasSessionSource({
  canEdit,
  getCanvasPayload,
  onCanvasContentChange,
  user,
  workspaceId,
}: {
  canEdit: boolean
  getCanvasPayload: (canvasId: ResourceId) => StaticCanvasDocumentPayload
  onCanvasContentChange?: CanvasContentChangeHandler
  user: { color: string; name: string }
  workspaceId: string
}): WizardEditorCanvasSessionPorts {
  const canEditRef = useRef(canEdit)
  const getCanvasPayloadRef = useRef(getCanvasPayload)
  const onCanvasContentChangeRef = useRef(onCanvasContentChange)
  const documentsRef = useRef(
    new Map<string, ReturnType<typeof createWizardEditorCanvasDocumentDoc>>(),
  )
  const sourceRef = useRef<WizardEditorCanvasSessionPorts | null>(null)
  const userRef = useRef(user)
  const workspaceIdRef = useRef(workspaceId)
  canEditRef.current = canEdit
  getCanvasPayloadRef.current = getCanvasPayload
  onCanvasContentChangeRef.current = onCanvasContentChange
  userRef.current = user
  workspaceIdRef.current = workspaceId

  useEffect(() => {
    const documents = documentsRef.current
    return () => {
      documents.forEach((doc) => doc.destroy())
      documents.clear()
    }
  }, [])

  if (!sourceRef.current) {
    sourceRef.current = createWizardEditorCanvasSessionPorts({
      access: {
        canEditCanvas: () => canEditRef.current,
      },
      documentSession: {
        useCanvasDocumentSession: ({ canEdit: canEditSession, canvas }) =>
          useInMemoryCanvasDocumentSession({
            canEdit: canEditSession,
            canvas,
            documentCache: documentsRef.current,
            getCanvasPayload: getCanvasPayloadRef.current,
            onContentChange: (input) => onCanvasContentChangeRef.current?.(input),
            user: userRef.current,
            workspaceId: workspaceIdRef.current,
          }),
      },
    })
  }

  return sourceRef.current
}

export function useInMemoryCanvasEmbeddedSessionSource({
  getEmbeddedCanvasPayload,
}: {
  getEmbeddedCanvasPayload: (canvasId: ResourceId) => StaticCanvasDocumentPayload
}): WizardEditorCanvasEmbeddedSessionPorts {
  const getEmbeddedCanvasPayloadRef = useRef(getEmbeddedCanvasPayload)
  const sourceRef = useRef<WizardEditorCanvasEmbeddedSessionPorts | null>(null)
  getEmbeddedCanvasPayloadRef.current = getEmbeddedCanvasPayload

  if (!sourceRef.current) {
    sourceRef.current = createWizardEditorCanvasEmbeddedSessionPorts({
      embeddedCanvas: {
        useEmbeddedCanvasState: (canvasId) => {
          const payload = getEmbeddedCanvasPayloadRef.current(canvasId)
          return createStaticEmbeddedCanvasState(payload)
        },
      },
    })
  }

  return sourceRef.current
}

function useInMemoryCanvasDocumentSession({
  canEdit,
  canvas,
  documentCache,
  getCanvasPayload,
  onContentChange,
  user,
  workspaceId,
}: {
  canEdit: boolean
  canvas: Parameters<WizardEditorCanvasSessionPorts['document']['useCanvasDocumentSession']>[0]
  documentCache: Map<string, ReturnType<typeof createWizardEditorCanvasDocumentDoc>>
  getCanvasPayload: (canvasId: ResourceId) => StaticCanvasDocumentPayload
  onContentChange: CanvasContentChangeHandler
  user: { color: string; name: string }
  workspaceId: string
}): ReturnType<WizardEditorCanvasSessionPorts['document']['useCanvasDocumentSession']> {
  const canEditRef = useRef(canEdit)
  const onContentChangeRef = useRef(onContentChange)
  canEditRef.current = canEdit
  onContentChangeRef.current = onContentChange
  const doc = getStaticCanvasDocument({
    cache: documentCache,
    canvasId: canvas.id,
    payload: getCanvasPayload(canvas.id),
    workspaceId,
  })
  useEffect(() => {
    const handleUpdate = () => {
      if (!canEditRef.current) return
      onContentChangeRef.current({
        canvasId: canvas.id,
        payload: readWizardEditorCanvasDocumentContent(doc),
      })
    }
    doc.on('update', handleUpdate)
    return () => doc.off('update', handleUpdate)
  }, [canvas.id, doc])

  return useWizardEditorCanvasDocumentSession({
    canvas,
    canEdit,
    collaboration: { status: 'ready', doc, collaboration: { status: 'unsupported' } },
    colorMode: 'light',
    user,
  })
}

function getStaticCanvasDocument({
  cache,
  canvasId,
  payload,
  workspaceId,
}: {
  cache: Map<string, ReturnType<typeof createWizardEditorCanvasDocumentDoc>>
  canvasId: ResourceId
  payload: StaticCanvasDocumentPayload
  workspaceId: string
}): ReturnType<typeof createWizardEditorCanvasDocumentDoc> {
  const documentKey = `${workspaceId}:${canvasId}`
  const existingDocument = cache.get(documentKey)
  if (existingDocument) return existingDocument

  const doc = createWizardEditorCanvasDocumentDoc(payload)
  cache.set(documentKey, doc)
  return doc
}

function createStaticEmbeddedCanvasState({
  edges,
  nodes,
}: StaticCanvasDocumentPayload): ReturnType<
  WizardEditorCanvasEmbeddedSessionPorts['embeddedCanvas']['useEmbeddedCanvasState']
> {
  return {
    nodes,
    edges,
    status: 'available',
  }
}
