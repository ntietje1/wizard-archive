import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent, MouseEvent, PointerEvent, WheelEvent } from 'react'
import type { CanvasDocumentController } from './document-controller'
import { captureCanvasSelection, materializeCanvasPaste } from './canvas-clipboard'
import type { CanvasClipboardEntry } from './canvas-clipboard'
import type { CanvasDocumentContent, CanvasTextDocumentNode } from './document-contract'
import { screenToCanvasPoint } from './canvas-viewport'
import type { CanvasInteractionController } from './interaction-controller'
import type { CanvasPoint, CanvasSelection, CanvasTool } from './interaction-types'
import { CanvasScene } from './canvas-scene'
import { CanvasContextMenu } from './canvas-context-menu'
import type { CanvasContextMenuRequest } from './canvas-context-menu'
import { CanvasSelectionActions } from './canvas-selection-actions'
import { CanvasSelectionProperties } from './canvas-selection-properties'
import { CanvasToolbar } from './canvas-toolbar'
import { projectCanvasResizeNodeBounds } from './canvas-resize-geometry'
import { canvasStrokeBounds } from './canvas-stroke-geometry'
import { createCanvasTextDocument } from './text/model'
import { loadCanvasViewport, saveCanvasViewport } from './viewport-storage'
import { DOMAIN_ID_KIND, generateDomainId } from '../resources/domain-id'
import type { ResourceId } from '../resources/domain-id'
import type {
  CanvasPreviewSource,
  ContentCollaboration,
} from '../resources/content-session-contract'
import { setCanvasCollaborationCursor } from './canvas-collaboration'

const DEFAULT_TEXT_NODE_SIZE = { width: 180, height: 80 }
const DEFAULT_DRAW_STYLE = { color: 'var(--foreground)', size: 4, opacity: 100 } as const
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
  documentController: CanvasDocumentController
  interactionController: CanvasInteractionController
  previews: CanvasPreviewSource
  resourceId: ResourceId
  title: string
}>

export function CanvasEditorSurface({
  canEdit,
  collaboration,
  documentController,
  interactionController,
  previews,
  resourceId,
  title,
}: CanvasEditorSurfaceProps) {
  const clipboard = useRef<CanvasClipboardEntry | null>(null)
  const surface = useRef<HTMLElement>(null)
  const [contextMenu, setContextMenu] = useState<CanvasContextMenuRequest | null>(null)
  const content = useCanvasDocumentContent(documentController)
  const interaction = useSyncExternalStore(
    interactionController.subscribe,
    interactionController.get,
    interactionController.get,
  )
  const history = useCanvasHistoryState(documentController)

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
    if (typeof window === 'undefined') return
    interactionController.setViewport(loadCanvasViewport(window.localStorage, resourceId))
    return interactionController.subscribeViewportCommit((viewport) =>
      saveCanvasViewport(window.localStorage, resourceId, viewport),
    )
  }, [interactionController, resourceId])

  useEffect(() => () => setCanvasCollaborationCursor(collaboration, null), [collaboration])

  const createTextNode = (point: CanvasPoint) => {
    if (!canEdit) return
    const node: CanvasTextDocumentNode = {
      id: generateDomainId(DOMAIN_ID_KIND.canvasNode),
      type: 'text',
      position: point,
      ...DEFAULT_TEXT_NODE_SIZE,
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
      className="canvas-editor-shell relative min-h-0 flex-1 overflow-hidden bg-background outline-none"
      data-testid="canvas-editor-shell"
      data-workspace-mode={canEdit ? 'editor' : 'viewer'}
      role="application"
      tabIndex={0}
      onKeyDown={handleKeyboard}
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
      <CanvasSelectionActions
        canEdit={canEdit}
        content={content}
        documentController={documentController}
        interaction={interaction}
      />
      <CanvasSelectionProperties
        canEdit={canEdit}
        content={content}
        documentController={documentController}
        interaction={interaction}
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
        />
      )}
      <section
        ref={surface}
        aria-label="Canvas surface"
        className={`relative size-full touch-none overflow-hidden bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:20px_20px] ${canvasToolCursor(interaction.tool)}`}
        data-tool={interaction.tool}
        data-testid="canvas-surface"
        tabIndex={-1}
        onContextMenu={(event) => {
          event.preventDefault()
          setContextMenu({ kind: 'pane', ...canvasMenuPosition(event) })
        }}
        onPointerDown={(event) => {
          setContextMenu(null)
          beginCanvasSurfaceInteraction(event, canEdit, interactionController, createTextNode)
        }}
        onPointerMove={(event) => {
          const point = localPoint(event, event.currentTarget)
          setCanvasCollaborationCursor(
            collaboration,
            screenToCanvasPoint(point, interactionController.get().viewport),
          )
          interactionController.updatePan(event.pointerId, point)
          if (canEdit && (event.buttons & 1) === 1) {
            const canvasPoint = screenToCanvasPoint(point, interactionController.get().viewport)
            updateCanvasEditGesture(
              interactionController,
              event.pointerId,
              canvasPoint,
              event.pressure,
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
              canvasPoint,
              event.pressure,
              event.shiftKey,
              event.metaKey || event.ctrlKey,
            )
          }
          interactionController.updateSelection(event.pointerId, canvasPoint, event.shiftKey)
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
          if (canEdit) {
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
        onWheel={(event) => handleWheel(event, interactionController)}
      >
        <CanvasScene
          canEdit={canEdit}
          collaboration={collaboration}
          content={content}
          documentController={documentController}
          interaction={interaction}
          interactionController={interactionController}
          onOpenContextMenu={openSelectionContextMenu}
          previews={previews}
          surface={surface}
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
  createTextNode: (point: CanvasPoint) => void,
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
      interactionController.beginDrawing(
        event.pointerId,
        canvasPoint,
        event.pressure,
        DEFAULT_DRAW_STYLE,
      )
      return
    case 'eraser':
      if (!canEdit) return
      event.currentTarget.setPointerCapture(event.pointerId)
      interactionController.beginErasing(event.pointerId, canvasPoint)
      return
    case 'text':
      if (canEdit) createTextNode(canvasPoint)
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
  point: CanvasPoint,
  pressure: number,
  square: boolean,
  snap: boolean,
) {
  controller.updateDrawing(pointerId, point, pressure, square)
  controller.updateErasing(pointerId, point)
  controller.updateConnection(pointerId, point)
  controller.updateResize(pointerId, point, square, snap)
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

function handleWheel(event: WheelEvent<HTMLElement>, controller: CanvasInteractionController) {
  if (event.target instanceof Element && event.target.closest('.nowheel')) return
  event.preventDefault()
  const viewport = controller.get().viewport
  if (event.ctrlKey) {
    const bounds = event.currentTarget.getBoundingClientRect()
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
        type: 'bezier',
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
