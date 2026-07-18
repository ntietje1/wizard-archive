import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import type { CanvasDocumentController } from './document-controller'
import { captureCanvasSelection, materializeCanvasPaste } from './canvas-clipboard'
import type { CanvasClipboardEntry } from './canvas-clipboard'
import type { CanvasDocumentContent, CanvasTextDocumentNode } from './document-contract'
import { screenToCanvasPoint } from './canvas-viewport'
import type {
  CanvasInteractionController,
  CanvasInteractionSnapshot,
} from './interaction-controller'
import type { createCanvasInteractionRenderStore } from './interaction-render-store'
import type {
  CanvasDrawPoint,
  CanvasPoint,
  CanvasSelection,
  CanvasTool,
  CanvasViewport,
} from './interaction-types'
import { CanvasScene } from './canvas-scene'
import { CanvasContextMenu } from './canvas-context-menu'
import type { CanvasContextMenuRequest } from './canvas-context-menu'
import { CanvasToolbar } from './canvas-toolbar'
import { CanvasConditionalToolbar } from './canvas-conditional-toolbar'
import { projectCanvasResizeNodeBounds } from './canvas-resize-geometry'
import { canvasStrokeBounds } from './canvas-stroke-geometry'
import { createCanvasTextDocument } from './text/model'
import { loadCanvasViewport, saveCanvasViewport } from './viewport-storage'
import { DOMAIN_ID_KIND, generateDomainId } from '../resources/domain-id'
import type { CanvasNodeId, ResourceId } from '../resources/domain-id'
import type { ContentCollaboration } from '../resources/content-session-contract'
import type { CanvasEmbedRenderer } from './canvas-editor'
import type { AuthoredDestinationDropResolver } from '../resources/authored-destination-drop'
import type { AuthoredDestination } from '../resources/authored-destination-contract'
import { setCanvasCollaborationCursor } from './canvas-collaboration'
import { useCanvasSurface } from './use-canvas-surface'
import { useCanvasDropTarget } from './canvas-drop-target'
import type { CanvasBounds } from './canvas-bounds'
import { canvasNodeSize } from './canvas-layout'
import type * as Y from 'yjs'
import { useResourcePreviewPublication } from '../resources/use-resource-preview-publication'
import type { ResourcePreviewPublicationBinding } from '../resources/use-resource-preview-publication'

const CANVAS_TOOL_SHORTCUTS = new Map<string, CanvasTool>([
  ['1', 'select'],
  ['2', 'hand'],
  ['3', 'lasso'],
  ['4', 'draw'],
  ['5', 'eraser'],
  ['6', 'text'],
  ['7', 'edge'],
])

type CanvasEditorSurfaceProps = Readonly<{
  canEdit: boolean
  collaboration: ContentCollaboration
  document: Y.Doc
  documentController: CanvasDocumentController
  drop: AuthoredDestinationDropResolver | null
  focusedNodeId: CanvasNodeId | null
  interactionController: CanvasInteractionController
  interactionRenderStore: ReturnType<typeof createCanvasInteractionRenderStore>
  openDestination: ((destination: AuthoredDestination) => void) | null
  previewPublication: ResourcePreviewPublicationBinding | null
  renderEmbed: CanvasEmbedRenderer
  resourceId: ResourceId
  title: string
}>

export function CanvasEditorSurface({
  canEdit,
  collaboration,
  document,
  documentController,
  drop,
  focusedNodeId,
  interactionController,
  interactionRenderStore,
  openDestination,
  previewPublication,
  renderEmbed,
  resourceId,
  title,
}: CanvasEditorSurfaceProps) {
  const clipboard = useRef<CanvasClipboardEntry | null>(null)
  const { attach: attachSurface, size: surfaceSize, surface } = useCanvasSurface()
  const [contextMenu, setContextMenu] = useState<CanvasContextMenuRequest | null>(null)
  const content = useCanvasDocumentContent(documentController)
  const interaction = useSyncExternalStore(
    interactionRenderStore.subscribe,
    interactionRenderStore.get,
    interactionRenderStore.get,
  )
  const history = useCanvasHistoryState(documentController)
  const consumedFocus = useRef<{
    documentController: CanvasDocumentController
    nodeId: CanvasNodeId
    stage: 'pending' | 'selected' | 'completed'
  } | null>(null)
  const dropTarget = useCanvasDropTarget({
    canEdit,
    documentController,
    drop,
    interactionController,
  })
  useResourcePreviewPublication({
    binding: previewPublication,
    containerRef: surface,
    document,
    enabled: canEdit,
    resolveElement: (container) => container,
  })

  useEffect(() => {
    interactionController.reconcileDocument(
      new Set(content.nodes.map((node) => node.id)),
      new Set(content.edges.map((edge) => edge.id)),
    )
  }, [content, interactionController])

  useEffect(() => {
    if (canEdit) return
    interactionController.cancelInteraction()
    interactionController.setTool('select')
  }, [canEdit, interactionController])

  useEffect(() => {
    const element = surface.current
    if (!element) return
    const onWheel = (event: WheelEvent) => handleWheel(event, element, interactionController)
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [interactionController, surface])

  useEffect(() => {
    if (typeof window === 'undefined') return
    interactionController.setViewport(loadCanvasViewport(window.localStorage, resourceId))
    return interactionController.subscribeViewportCommit((viewport) =>
      saveCanvasViewport(window.localStorage, resourceId, viewport),
    )
  }, [interactionController, resourceId])

  useEffect(() => {
    if (!focusedNodeId) {
      consumedFocus.current = null
      return
    }
    if (
      consumedFocus.current?.documentController !== documentController ||
      consumedFocus.current.nodeId !== focusedNodeId
    ) {
      consumedFocus.current = {
        documentController,
        nodeId: focusedNodeId,
        stage: 'pending',
      }
    }
    const focus = consumedFocus.current
    const node = content.nodes.find(
      (candidate) => candidate.id === focusedNodeId && !candidate.hidden,
    )
    if (!node) return
    if (focus.stage === 'pending') {
      interactionController.setTool('select')
      interactionController.setSelection({ nodeIds: new Set([node.id]), edgeIds: new Set() })
      focus.stage = 'selected'
    }
    if (focus.stage === 'completed' || surfaceSize.width <= 0 || surfaceSize.height <= 0) return
    const size = canvasNodeSize(node)
    const zoom = interactionController.get().viewport.zoom
    interactionController.setViewport(
      {
        x: surfaceSize.width / 2 - (node.position.x + size.width / 2) * zoom,
        y: surfaceSize.height / 2 - (node.position.y + size.height / 2) * zoom,
        zoom,
      },
      true,
    )
    focus.stage = 'completed'
  }, [content.nodes, documentController, focusedNodeId, interactionController, surfaceSize])

  useEffect(() => () => setCanvasCollaborationCursor(collaboration, null), [collaboration])

  const createTextNode = (bounds: CanvasBounds) => {
    if (!canEdit) return
    const node: CanvasTextDocumentNode = {
      id: generateDomainId(DOMAIN_ID_KIND.canvasNode),
      type: 'text',
      position: { x: bounds.x, y: bounds.y },
      width: bounds.width,
      height: bounds.height,
      data: { content: createCanvasTextDocument('') },
    }
    documentController.apply({ type: 'insert', nodes: [node], edges: [] })
    interactionController.setTool('select')
    interactionController.setSelection({ nodeIds: new Set([node.id]), edgeIds: new Set() })
    interactionController.editNode(node.id)
  }

  const removeSelection = () => {
    const snapshot = interactionController.get()
    if (!canEdit || snapshot.interaction.type === 'editing') return
    documentController.apply({
      type: 'remove',
      nodeIds: Array.from(snapshot.selection.nodeIds),
      edgeIds: Array.from(snapshot.selection.edgeIds),
    })
    interactionController.clearSelection()
  }

  const copySelection = () => {
    const copied = captureCanvasSelection(content, interactionController.get().selection)
    if (!copied) return false
    clipboard.current = copied
    return true
  }

  const pasteClipboard = (entry = clipboard.current) => {
    if (!canEdit || !entry) return false
    const pasted = materializeCanvasPaste(content, entry)
    if (!pasted) return false
    documentController.apply(pasted.change)
    clipboard.current = pasted.nextClipboard
    interactionController.setSelection(pasted.selection)
    return true
  }

  const cutSelection = () => {
    if (!canEdit || !copySelection()) return false
    removeSelection()
    return true
  }

  const duplicateSelection = () => {
    if (!canEdit) return false
    const copied = captureCanvasSelection(content, interactionController.get().selection)
    return copied ? pasteClipboard(copied) : false
  }

  const selectAll = () =>
    interactionController.setSelection({
      nodeIds: new Set(content.nodes.map((node) => node.id)),
      edgeIds: new Set(content.edges.map((edge) => edge.id)),
    })

  const openSelectionContextMenu = (event: MouseEvent<Element>, selection: CanvasSelection) => {
    event.preventDefault()
    interactionController.setSelection(selection)
    setContextMenu({ kind: 'selection', ...canvasMenuPosition(event) })
  }

  const actions = {
    copy: copySelection,
    cut: cutSelection,
    delete: removeSelection,
    duplicate: duplicateSelection,
    paste: pasteClipboard,
    redo: () => documentController.redo(),
    selectAll,
    undo: () => documentController.undo(),
  }

  const handleKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (event.repeat) return
    const snapshot = interactionController.get()
    if (snapshot.interaction.type === 'editing') {
      if (event.key === 'Escape') interactionController.finishEditing()
      return
    }
    if (isCanvasTextEntryTarget(event.target)) return
    const primary = event.metaKey || event.ctrlKey
    const key = event.key.toLowerCase()
    if (primary && handleCanvasPrimaryShortcut(event, key, canEdit, actions)) {
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      removeSelection()
      return
    }
    if (event.key === 'Escape') {
      interactionController.cancelInteraction()
      interactionController.clearSelection()
      return
    }
    if (!canEdit || primary || event.altKey) return
    const tool = CANVAS_TOOL_SHORTCUTS.get(key)
    if (tool) interactionController.setTool(tool)
  }

  return (
    <div
      aria-label={`${title} canvas editor`}
      className="canvas-editor-shell allow-motion relative min-h-0 flex-1 overflow-hidden bg-background outline-none"
      data-testid="canvas-editor-shell"
      data-workspace-mode={canEdit ? 'editor' : 'viewer'}
      role="application"
      tabIndex={0}
      onKeyDownCapture={handleKeyboard}
    >
      <CanvasToolbar
        canEdit={canEdit}
        content={content}
        documentController={documentController}
        history={history}
        interaction={interaction}
        interactionController={interactionController}
        surface={surface}
      />
      <CanvasConditionalToolbar
        canEdit={canEdit}
        content={content}
        documentController={documentController}
        interaction={interaction}
        interactionController={interactionController}
      />
      {contextMenu && (
        <CanvasContextMenu
          actions={actions}
          canEdit={canEdit}
          canPaste={clipboard.current !== null}
          content={content}
          documentController={documentController}
          request={contextMenu}
          selection={interaction.selection}
          onClose={() => setContextMenu(null)}
          onOpenDestination={openDestination}
        />
      )}
      <section
        ref={attachSurface}
        aria-label="Canvas surface"
        className={`relative z-0 size-full touch-none overflow-hidden data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-inset data-[drop-target=true]:ring-ring ${canvasToolCursor(interaction.tool)}`}
        data-tool={interaction.tool}
        data-testid="canvas-surface"
        style={{
          backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
          backgroundPosition: `${interaction.viewport.x}px ${interaction.viewport.y}px`,
          backgroundSize: `${36 * Math.sqrt(interaction.viewport.zoom)}px ${36 * Math.sqrt(interaction.viewport.zoom)}px`,
        }}
        tabIndex={-1}
        onDragEnter={dropTarget.onDragEnter}
        onDragOver={dropTarget.onDragOver}
        onDragLeave={dropTarget.onDragLeave}
        onDrop={dropTarget.onDrop}
        onContextMenu={(event) => {
          event.preventDefault()
          setContextMenu({ kind: 'pane', ...canvasMenuPosition(event) })
        }}
        onPointerDown={(event) => {
          setContextMenu(null)
          beginCanvasSurfaceInteraction(event, canEdit, interactionController)
        }}
        onPointerMoveCapture={(event) => {
          measureCanvasGestureFrame(event.currentTarget, interactionController.get().interaction)
        }}
        onPointerMove={(event) => {
          const point = localPoint(event, event.currentTarget)
          const viewport = interactionController.get().viewport
          setCanvasCollaborationCursor(collaboration, screenToCanvasPoint(point, viewport))
          interactionController.updatePan(event.pointerId, point)
          if (canEdit && (event.buttons & 1) === 1) {
            updateCanvasEditGesture(
              interactionController,
              event.pointerId,
              canvasPointerSamples(event, event.currentTarget, viewport),
              event.shiftKey,
              event.metaKey || event.ctrlKey,
            )
          }
          interactionController.updateSelection(
            event.pointerId,
            screenToCanvasPoint(point, interactionController.get().viewport),
            event.shiftKey,
          )
        }}
        onPointerUp={(event) => {
          const snapshot = interactionController.get()
          const point = localPoint(event, event.currentTarget)
          const canvasPoint = screenToCanvasPoint(point, snapshot.viewport)
          interactionController.updatePan(event.pointerId, point)
          if (canEdit) {
            updateCanvasEditGesture(
              interactionController,
              event.pointerId,
              canvasPointerSamples(event, event.currentTarget, snapshot.viewport),
              event.shiftKey,
              event.metaKey || event.ctrlKey,
            )
          }
          interactionController.updateSelection(event.pointerId, canvasPoint, event.shiftKey)
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
          if (canEdit) {
            if (commitTextPlacement(event.pointerId, interactionController, createTextNode)) return
            if (commitResize(event.pointerId, interactionController, documentController)) return
            if (commitConnection(event.pointerId, interactionController, documentController)) return
            if (commitErasing(event.pointerId, interactionController, documentController)) return
            if (commitDrawing(event.pointerId, interactionController, documentController)) return
          }
          if (interactionController.commitPan(event.pointerId)) return
          commitAreaSelection(event.pointerId, interactionController)
        }}
        onPointerCancel={() => interactionController.cancelInteraction()}
        onPointerLeave={() => setCanvasCollaborationCursor(collaboration, null)}
      >
        <CanvasScene
          canEdit={canEdit}
          collaboration={collaboration}
          content={content}
          documentController={documentController}
          interaction={interaction}
          interactionController={interactionController}
          onOpenContextMenu={openSelectionContextMenu}
          renderEmbed={renderEmbed}
          surface={surface}
          surfaceSize={surfaceSize}
        />
      </section>
    </div>
  )
}

type CanvasKeyboardActions = Readonly<{
  copy(): boolean
  cut(): boolean
  duplicate(): boolean
  paste(): boolean
  redo(): boolean
  selectAll(): unknown
  undo(): boolean
}>

function handleCanvasPrimaryShortcut(
  event: KeyboardEvent<HTMLElement>,
  key: string,
  canEdit: boolean,
  actions: CanvasKeyboardActions,
): boolean {
  if (key === 'a') {
    event.preventDefault()
    actions.selectAll()
    return true
  }
  if (key === 'y' || key === 'z') {
    if (canEdit) {
      event.preventDefault()
      if (key === 'y' || event.shiftKey) actions.redo()
      else actions.undo()
    }
    return true
  }
  return handleCanvasClipboardShortcut(event, key, canEdit, actions)
}

function handleCanvasClipboardShortcut(
  event: KeyboardEvent<HTMLElement>,
  key: string,
  canEdit: boolean,
  actions: CanvasKeyboardActions,
): boolean {
  switch (key) {
    case 'c':
      if (actions.copy()) event.preventDefault()
      return true
    case 'd':
      if (canEdit && actions.duplicate()) event.preventDefault()
      return true
    case 'v':
      if (canEdit && actions.paste()) event.preventDefault()
      return true
    case 'x':
      if (canEdit && actions.cut()) event.preventDefault()
      return true
    default:
      return false
  }
}

function isCanvasTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.closest('input, select, textarea, [contenteditable="true"]') !== null
  )
}

function canvasMenuPosition(event: MouseEvent<Element>): Readonly<{ x: number; y: number }> {
  const maximumX = Math.max(8, document.documentElement.clientWidth - 360)
  const maximumY = Math.max(8, document.documentElement.clientHeight - 320)
  const requestedX = Number.isFinite(event.clientX) ? event.clientX : 8
  const requestedY = Number.isFinite(event.clientY) ? event.clientY : 8
  return {
    x: Math.max(8, Math.min(requestedX, maximumX)),
    y: Math.max(8, Math.min(requestedY, maximumY)),
  }
}

function beginCanvasSurfaceInteraction(
  event: PointerEvent<HTMLElement>,
  canEdit: boolean,
  interactionController: CanvasInteractionController,
) {
  event.currentTarget.focus()
  const snapshot = interactionController.get()
  const point = localPoint(event, event.currentTarget)
  if (event.button === 1 || snapshot.tool === 'hand') {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    interactionController.beginPan(event.pointerId, point)
    return
  }
  if (event.button !== 0) return
  const canvasPoint = screenToCanvasPoint(point, snapshot.viewport)
  switch (snapshot.tool) {
    case 'draw':
      if (!canEdit) return
      event.currentTarget.setPointerCapture(event.pointerId)
      interactionController.beginDrawing(event.pointerId, canvasPoint, event.pressure)
      return
    case 'eraser':
      if (!canEdit) return
      event.currentTarget.setPointerCapture(event.pointerId)
      interactionController.beginErasing(event.pointerId, canvasPoint)
      return
    case 'text':
      if (!canEdit) return
      event.currentTarget.setPointerCapture(event.pointerId)
      interactionController.beginTextPlacement(event.pointerId, canvasPoint)
      return
    case 'select':
    case 'lasso':
      event.currentTarget.setPointerCapture(event.pointerId)
      interactionController.beginSelection(
        snapshot.tool === 'select' ? 'marquee' : 'lasso',
        event.metaKey || event.ctrlKey ? 'add' : 'replace',
        event.pointerId,
        canvasPoint,
      )
      return
    case 'edge':
      return
  }
}

function updateCanvasEditGesture(
  controller: CanvasInteractionController,
  pointerId: number,
  drawingPoints: ReadonlyArray<CanvasDrawPoint>,
  square: boolean,
  snap: boolean,
) {
  const [x, y] = drawingPoints[drawingPoints.length - 1]!
  const point = { x, y }
  controller.updateDrawing(pointerId, drawingPoints, square)
  controller.updateTextPlacement(pointerId, point, square)
  controller.updateErasing(pointerId, point)
  controller.updateConnection(pointerId, point)
  controller.updateResize(pointerId, point, square, snap)
}

function commitTextPlacement(
  pointerId: number,
  interactionController: CanvasInteractionController,
  createTextNode: (bounds: CanvasBounds) => void,
): boolean {
  const bounds = interactionController.commitTextPlacement(pointerId)
  if (!bounds) return false
  createTextNode(bounds)
  return true
}

function useCanvasDocumentContent(controller: CanvasDocumentController): CanvasDocumentContent {
  const [content, setContent] = useState(() => controller.read())
  useEffect(() => {
    const sync = () => setContent(controller.read())
    const unsubscribe = controller.subscribe(sync)
    sync()
    return unsubscribe
  }, [controller])
  return content
}

type CanvasHistoryState = 'both' | 'empty' | 'redo' | 'undo'

function useCanvasHistoryState(controller: CanvasDocumentController): CanvasHistoryState {
  return useSyncExternalStore(
    (listener) => controller.subscribeHistory(listener),
    () => canvasHistoryState(controller),
    () => canvasHistoryState(controller),
  )
}

function canvasHistoryState(controller: CanvasDocumentController): CanvasHistoryState {
  if (controller.canUndo) return controller.canRedo ? 'both' : 'undo'
  return controller.canRedo ? 'redo' : 'empty'
}

function localPoint(event: PointerEvent<HTMLElement>, surface: HTMLElement): CanvasPoint {
  const bounds = surface.getBoundingClientRect()
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}

function canvasPointerSamples(
  event: PointerEvent<HTMLElement>,
  surface: HTMLElement,
  viewport: CanvasViewport,
): ReadonlyArray<CanvasDrawPoint> {
  const bounds = surface.getBoundingClientRect()
  const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? []
  const samples = [...coalesced]
  const last = samples[samples.length - 1]
  if (
    !last ||
    last.clientX !== event.nativeEvent.clientX ||
    last.clientY !== event.nativeEvent.clientY
  ) {
    samples.push(event.nativeEvent)
  }
  return samples.map((sample) => {
    const point = screenToCanvasPoint(
      { x: sample.clientX - bounds.left, y: sample.clientY - bounds.top },
      viewport,
    )
    return [point.x, point.y, sample.pressure] as const
  })
}

function measureCanvasGestureFrame(
  surface: HTMLElement,
  interaction: CanvasInteractionSnapshot['interaction'],
) {
  const measureName = surface.dataset.canvasPerformanceMeasure
  if (!measureName || interaction.type === 'idle') return
  const gesture = interaction.type === 'selecting' ? interaction.kind : interaction.type
  const startedAt = performance.now()
  queueMicrotask(() => {
    const handlerDuration = performance.now() - startedAt
    requestAnimationFrame(() => {
      performance.measure(measureName, {
        start: startedAt,
        end: performance.now(),
        detail: { gesture, handlerDuration },
      })
    })
  })
}

function handleWheel(
  event: WheelEvent,
  surface: HTMLElement,
  controller: CanvasInteractionController,
) {
  const viewport = controller.get().viewport
  if (event.ctrlKey) {
    event.preventDefault()
    const bounds = surface.getBoundingClientRect()
    controller.zoomTo(
      viewport.zoom * 2 ** (-event.deltaY * 0.002),
      {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      },
      true,
    )
    return
  }
  if (event.target instanceof Element && event.target.closest('.nowheel')) return
  event.preventDefault()
  controller.panBy(
    event.shiftKey ? { x: -event.deltaY, y: 0 } : { x: -event.deltaX, y: -event.deltaY },
    true,
  )
}

function commitAreaSelection(pointerId: number, controller: CanvasInteractionController) {
  const gesture = controller.get().interaction
  if (gesture.type !== 'selecting' || gesture.pointerId !== pointerId) return
  const committed = controller.commitSelection(pointerId)
  const isClick =
    gesture.kind === 'marquee' &&
    Math.hypot(gesture.current.x - gesture.origin.x, gesture.current.y - gesture.origin.y) *
      controller.get().viewport.zoom <=
      1
  if (!committed && isClick && gesture.mode === 'replace') {
    controller.clearSelection()
  }
}

function canvasToolCursor(tool: CanvasTool): string {
  if (tool === 'hand') return 'cursor-grab'
  if (tool === 'eraser') return 'cursor-cell'
  if (tool === 'draw' || tool === 'edge' || tool === 'lasso' || tool === 'text') {
    return 'cursor-crosshair'
  }
  return 'cursor-default'
}

function commitResize(
  pointerId: number,
  interactionController: CanvasInteractionController,
  documentController: CanvasDocumentController,
): boolean {
  const interaction = interactionController.get().interaction
  if (interaction.type !== 'resizing' || interaction.pointerId !== pointerId) return false
  const resize = interactionController.commitResize(pointerId)
  if (!resize) return true
  const projected = projectCanvasResizeNodeBounds(
    resize.initialBounds,
    resize.bounds,
    resize.initialNodeBounds,
  )
  const nodes = documentController.read().nodes.flatMap((node) => {
    const bounds = projected.get(node.id)
    return bounds
      ? [
          {
            id: node.id,
            type: node.type,
            position: { x: bounds.x, y: bounds.y },
            width: bounds.width,
            height: bounds.height,
          },
        ]
      : []
  })
  documentController.apply({ type: 'update', nodes, edges: [] })
  return true
}

function commitConnection(
  pointerId: number,
  interactionController: CanvasInteractionController,
  documentController: CanvasDocumentController,
): boolean {
  const interaction = interactionController.get().interaction
  const connecting = interaction.type === 'connecting' && interaction.pointerId === pointerId
  if (!connecting) return false
  const settings = interactionController.get().toolSettings
  const connection = interactionController.commitConnection(pointerId)
  if (!connection) return true
  const id = `e-${connection.source.nodeId}-${connection.target.nodeId}-${crypto.randomUUID()}`
  documentController.apply({
    type: 'insert',
    nodes: [],
    edges: [
      {
        id,
        source: connection.source.nodeId,
        target: connection.target.nodeId,
        sourceHandle: connection.source.handle,
        targetHandle: connection.target.handle,
        type: settings.edgeType,
        style: {
          stroke: settings.strokeColor,
          strokeWidth: settings.strokeSize,
          opacity: settings.strokeOpacity / 100,
        },
      },
    ],
  })
  interactionController.setSelection({ nodeIds: new Set(), edgeIds: new Set([id]) })
  return true
}

function commitErasing(
  pointerId: number,
  interactionController: CanvasInteractionController,
  documentController: CanvasDocumentController,
): boolean {
  const nodeIds = interactionController.commitErasing(pointerId)
  if (!nodeIds) return false
  documentController.apply({ type: 'remove', nodeIds: Array.from(nodeIds), edgeIds: [] })
  return true
}

function commitDrawing(
  pointerId: number,
  interactionController: CanvasInteractionController,
  documentController: CanvasDocumentController,
): boolean {
  const drawing = interactionController.commitDrawing(pointerId)
  if (!drawing) return false
  const bounds = canvasStrokeBounds(drawing.points, drawing.style.size)
  documentController.apply({
    type: 'insert',
    nodes: [
      {
        id: generateDomainId(DOMAIN_ID_KIND.canvasNode),
        type: 'stroke',
        position: { x: bounds.x, y: bounds.y },
        width: bounds.width,
        height: bounds.height,
        data: {
          points: drawing.points.map(([x, y, pressure]) => [x, y, pressure]),
          ...drawing.style,
          bounds,
        },
      },
    ],
    edges: [],
  })
  return true
}
