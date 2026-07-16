import {
  Hand,
  LassoSelect,
  Maximize,
  MousePointer2,
  Redo2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { KeyboardEvent, PointerEvent, RefObject, WheelEvent } from 'react'
import { CanvasDocumentController } from './document-controller'
import type { CanvasDocumentContent, CanvasTextDocumentNode } from './document-contract'
import { CanvasInteractionController, screenToCanvasPoint } from './interaction-controller'
import type { CanvasInteractionSnapshot, CanvasPoint, CanvasTool } from './interaction-controller'
import { CanvasScene } from './canvas-scene'
import { fitCanvasContent } from './canvas-layout'
import { createCanvasTextDocument } from './text/model'
import { loadCanvasViewport, saveCanvasViewport } from './viewport-storage'
import {
  canvasBoundsFromPoints,
  selectCanvasContentInPolygon,
  selectCanvasContentInRectangle,
} from './selection-geometry'
import { DOMAIN_ID_KIND, generateDomainId } from '../resources/domain-id'
import type { ResourceId } from '../resources/domain-id'
import type { CanvasSession } from '../resources/content-session-contract'

const DEFAULT_TEXT_NODE_SIZE = { width: 180, height: 80 }
const TOOL_BUTTONS: ReadonlyArray<Readonly<{ tool: CanvasTool; label: string; icon: LucideIcon }>> =
  [
    { tool: 'select', label: 'Pointer', icon: MousePointer2 },
    { tool: 'lasso', label: 'Lasso select', icon: LassoSelect },
    { tool: 'text', label: 'Text', icon: Type },
    { tool: 'hand', label: 'Hand', icon: Hand },
  ]

export function CanvasEditor({
  canEdit,
  resourceId,
  session,
  title,
}: {
  canEdit: boolean
  resourceId: ResourceId
  session: CanvasSession
  title: string
}) {
  const [documentController] = useState(() => new CanvasDocumentController(session.document))
  const [interactionController] = useState(() => new CanvasInteractionController())
  const surface = useRef<HTMLElement>(null)
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
    if (typeof window === 'undefined') return
    interactionController.setViewport(loadCanvasViewport(window.localStorage, resourceId))
    return interactionController.subscribeViewportCommit((viewport) =>
      saveCanvasViewport(window.localStorage, resourceId, viewport),
    )
  }, [interactionController, resourceId])

  useEffect(
    () => () => {
      interactionController.dispose()
      documentController.dispose()
    },
    [documentController, interactionController],
  )

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

  const handleKeyboard = (event: KeyboardEvent<HTMLElement>) => {
    const snapshot = interactionController.get()
    if (snapshot.interaction.type === 'editing') {
      if (event.key === 'Escape') interactionController.finishEditing()
      return
    }
    const primary = event.metaKey || event.ctrlKey
    if (primary && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      if (event.shiftKey) documentController.redo()
      else documentController.undo()
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
    }
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
      <section
        ref={surface}
        aria-label="Canvas surface"
        className={`relative size-full touch-none overflow-hidden bg-[radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] [background-size:20px_20px] ${canvasToolCursor(interaction.tool)}`}
        data-tool={interaction.tool}
        data-testid="canvas-surface"
        tabIndex={-1}
        onPointerDown={(event) => {
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
          if (snapshot.tool === 'text') {
            createTextNode(screenToCanvasPoint(point, snapshot.viewport))
            return
          }
          if (snapshot.tool === 'select' || snapshot.tool === 'lasso') {
            event.currentTarget.setPointerCapture(event.pointerId)
            interactionController.beginSelection(
              snapshot.tool === 'select' ? 'marquee' : 'lasso',
              event.metaKey || event.ctrlKey ? 'add' : 'replace',
              event.pointerId,
              screenToCanvasPoint(point, snapshot.viewport),
            )
          }
        }}
        onPointerMove={(event) => {
          const point = localPoint(event, event.currentTarget)
          interactionController.updatePan(event.pointerId, point)
          updateAreaSelection(
            event.pointerId,
            screenToCanvasPoint(point, interactionController.get().viewport),
            content,
            interactionController,
            event.shiftKey,
          )
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
          }
          if (interactionController.commitPan(event.pointerId)) return
          commitAreaSelection(event.pointerId, interactionController)
        }}
        onPointerCancel={() => interactionController.cancelInteraction()}
        onWheel={(event) => handleWheel(event, interactionController)}
      >
        <CanvasScene
          canEdit={canEdit}
          content={content}
          documentController={documentController}
          interaction={interaction}
          interactionController={interactionController}
          surface={surface}
        />
      </section>
    </div>
  )
}

function CanvasToolbar({
  canEdit,
  content,
  documentController,
  history,
  interaction,
  interactionController,
  surface,
}: {
  canEdit: boolean
  content: CanvasDocumentContent
  documentController: CanvasDocumentController
  history: CanvasHistoryState
  interaction: CanvasInteractionSnapshot
  interactionController: CanvasInteractionController
  surface: RefObject<HTMLElement | null>
}) {
  return (
    <>
      {canEdit && (
        <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-sm backdrop-blur">
          {TOOL_BUTTONS.map(({ tool, label, icon: Icon }) => (
            <button
              key={tool}
              type="button"
              aria-label={label}
              aria-pressed={interaction.tool === tool}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              onClick={() => interactionController.setTool(tool)}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      )}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-sm backdrop-blur">
        {canEdit && (
          <>
            <ToolbarButton
              label="Undo"
              disabled={history !== 'undo' && history !== 'both'}
              icon={Undo2}
              onClick={() => documentController.undo()}
            />
            <ToolbarButton
              label="Redo"
              disabled={history !== 'redo' && history !== 'both'}
              icon={Redo2}
              onClick={() => documentController.redo()}
            />
            <span className="mx-0.5 h-5 w-px bg-border" />
          </>
        )}
        <ToolbarButton
          label="Zoom out"
          icon={ZoomOut}
          onClick={() =>
            interactionController.zoomTo(interaction.viewport.zoom / 1.2, undefined, true)
          }
        />
        <span className="min-w-12 text-center text-xs tabular-nums">
          {Math.round(interaction.viewport.zoom * 100)}%
        </span>
        <ToolbarButton
          label="Zoom in"
          icon={ZoomIn}
          onClick={() =>
            interactionController.zoomTo(interaction.viewport.zoom * 1.2, undefined, true)
          }
        />
        <ToolbarButton
          label="Fit view"
          icon={Maximize}
          onClick={() => {
            const bounds = surface.current?.getBoundingClientRect()
            if (!bounds) return
            const viewport = fitCanvasContent(content.nodes, bounds.width, bounds.height)
            if (viewport) interactionController.setViewport(viewport, true)
          }}
        />
      </div>
    </>
  )
}

function ToolbarButton({
  disabled = false,
  icon: Icon,
  label,
  onClick,
}: {
  disabled?: boolean
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40"
      onClick={onClick}
    >
      <Icon className="size-4" />
    </button>
  )
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

function updateAreaSelection(
  pointerId: number,
  point: CanvasPoint,
  content: CanvasDocumentContent,
  controller: CanvasInteractionController,
  square: boolean,
) {
  const snapshot = controller.get()
  const gesture = snapshot.interaction
  if (gesture.type !== 'selecting' || gesture.pointerId !== pointerId) return
  if (gesture.kind === 'marquee') {
    const current = square ? squareSelectionPoint(gesture.origin, point) : point
    const bounds = canvasBoundsFromPoints(gesture.origin, current)
    const distance = Math.hypot(bounds.width, bounds.height) * snapshot.viewport.zoom
    controller.updateSelection(
      pointerId,
      current,
      distance > 1 ? selectCanvasContentInRectangle(content, bounds, snapshot.viewport.zoom) : null,
    )
    return
  }
  const points = [...gesture.points, point]
  controller.updateSelection(
    pointerId,
    point,
    points.length >= 3 ? selectCanvasContentInPolygon(content, points) : null,
  )
}

function squareSelectionPoint(origin: CanvasPoint, point: CanvasPoint): CanvasPoint {
  const size = Math.max(Math.abs(point.x - origin.x), Math.abs(point.y - origin.y))
  return {
    x: origin.x + (point.x < origin.x ? -size : size),
    y: origin.y + (point.y < origin.y ? -size : size),
  }
}

function commitAreaSelection(pointerId: number, controller: CanvasInteractionController) {
  const gesture = controller.get().interaction
  if (gesture.type !== 'selecting' || gesture.pointerId !== pointerId) return
  const committed = controller.commitSelection(pointerId)
  if (!committed && gesture.kind === 'marquee' && gesture.mode === 'replace') {
    controller.clearSelection()
  }
}

function canvasToolCursor(tool: CanvasTool): string {
  if (tool === 'hand') return 'cursor-grab'
  if (tool === 'lasso' || tool === 'text') return 'cursor-crosshair'
  return 'cursor-default'
}
