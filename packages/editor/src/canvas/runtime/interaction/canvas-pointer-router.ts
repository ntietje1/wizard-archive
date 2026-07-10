import { getMeasuredCanvasNodesFromEngineSnapshot } from '../document/canvas-measured-nodes'
import {
  createCanvasSelectionGestureController,
  createLassoSelectionStrategy,
  createRectangleSelectionStrategy,
} from '../selection/canvas-selection-gesture-controller'
import { isCanvasEmptyPaneTarget } from './canvas-pane-targets'
import { isPrimarySelectionModifier } from '../../utils/canvas-selection-utils'
import type { CanvasEngine } from '../../system/canvas-engine-types'
import type { CanvasDragController } from '../../system/canvas-drag-controller'
import type { CanvasViewportController } from '../../system/canvas-viewport-controller'
import type {
  CanvasAwarenessPresenceWriter,
  CanvasInteractionTools,
  CanvasSelectionController,
  CanvasToolHandlers,
  CanvasToolId,
} from '../../tools/canvas-tool-types'
import type { CanvasToolLocalOverlayControls } from '../../stores/canvas-tool-local-overlay-store'

type CanvasPointerTarget =
  | { kind: 'blocked-interactive-child' }
  | { kind: 'connection-handle' }
  | { kind: 'edge' }
  | { kind: 'node'; nodeId: string; source: 'node-shell' | 'selection-overlay' }
  | { kind: 'outside' }
  | { kind: 'pane' }
  | { kind: 'resize-handle' }

type ActivePointerGesture =
  | {
      kind: 'selection'
      pointerId: number
      activeTool: CanvasToolId
      startTargetKind: CanvasPointerTarget['kind']
      controller: ReturnType<typeof createCanvasSelectionGestureController>
      startPoint: { x: number; y: number }
      lastPoint: { x: number; y: number }
    }
  | {
      kind: 'node-drag'
      nodeId: string
      pointerId: number
      controller: CanvasDragController
      source: Extract<CanvasPointerTarget, { kind: 'node' }>['source']
      startPoint: { x: number; y: number }
    }
  | {
      kind: 'tool'
      pointerId: number
      handlers: CanvasToolHandlers
    }

export interface CanvasPointerRouterOptions {
  enabled: boolean
  activeTool: CanvasToolId
  activeToolHandlers: CanvasToolHandlers
  nodeDragController: CanvasDragController | null
  canvasEngine: CanvasEngine
  viewportController: Pick<CanvasViewportController, 'getZoom' | 'screenToCanvasPosition'>
  awareness: CanvasAwarenessPresenceWriter
  selection: Pick<
    CanvasSelectionController,
    | 'beginGesture'
    | 'cancelGesture'
    | 'clearSelection'
    | 'commitGesture'
    | 'getSnapshot'
    | 'setGesturePreview'
    | 'toggleNode'
  >
  getShiftPressed: () => boolean
  localOverlay: CanvasToolLocalOverlayControls
  setActiveTool: (tool: CanvasToolId) => void
}

export interface CanvasPointerRouter {
  interaction: CanvasInteractionTools
  attach: (surfaceElement: HTMLElement | null) => () => void
  setOptions: (options: CanvasPointerRouterOptions) => void
  cancelActiveGesture: () => void
}

export function createCanvasPointerRouter(): CanvasPointerRouter {
  return new CanvasPointerRouterController()
}

class CanvasPointerRouterController implements CanvasPointerRouter {
  private options: CanvasPointerRouterOptions | null = null
  private surfaceElement: HTMLElement | null = null
  private activeGesture: ActivePointerGesture | null = null
  private captureTarget: Element | null = null
  private suppressNextClick = false
  private readonly capture = true

  readonly interaction: CanvasInteractionTools = {
    suppressNextSurfaceClick: () => {
      this.suppressNextClick = true
    },
  }

  attach = (nextSurfaceElement: HTMLElement | null) => {
    const attachedElement = nextSurfaceElement
    this.surfaceElement = attachedElement
    if (!attachedElement) {
      return () => undefined
    }

    attachedElement.addEventListener('pointerdown', this.onPointerDown)
    attachedElement.addEventListener('click', this.onClickCapture, true)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)

    return () => {
      attachedElement.removeEventListener('pointerdown', this.onPointerDown)
      attachedElement.removeEventListener('click', this.onClickCapture, true)
      window.removeEventListener('keydown', this.onKeyDown)
      window.removeEventListener('keyup', this.onKeyUp)
      this.cancelActiveGesture()
      if (this.surfaceElement === attachedElement) {
        this.surfaceElement = null
      }
    }
  }

  setOptions = (nextOptions: CanvasPointerRouterOptions) => {
    if (this.options?.enabled && !nextOptions.enabled) {
      this.cancelActiveGesture()
    }
    this.options = nextOptions
  }

  cancelActiveGesture = () => {
    const gesture = this.activeGesture
    if (gesture?.kind === 'selection') {
      gesture.controller.cancel()
    } else if (gesture?.kind === 'node-drag') {
      gesture.controller.cancel(createPointerCancelEvent(gesture.pointerId))
    } else if (gesture?.kind === 'tool') {
      gesture.handlers.onPointerCancel?.(createPointerCancelEvent(gesture.pointerId))
    }
    this.endActiveGesture()
  }

  private readonly getPane = () =>
    this.surfaceElement?.querySelector<HTMLElement>('[data-canvas-pane="true"]') ?? null

  private readonly getPointerInput = (event: PointerEvent) => {
    const currentOptions = requireOptions(this.options)
    const clientPoint = {
      x: event.clientX,
      y: event.clientY,
    }
    return {
      clientPoint,
      canvasPoint: currentOptions.viewportController.screenToCanvasPosition(clientPoint),
      square: event.shiftKey || currentOptions.getShiftPressed(),
    }
  }

  private readonly addWindowGestureListeners = () => {
    window.addEventListener('pointermove', this.onPointerMove, this.capture)
    window.addEventListener('pointerup', this.onPointerUp, this.capture)
    window.addEventListener('pointercancel', this.onPointerCancel, this.capture)
    window.addEventListener('selectstart', this.preventNativeGesture, this.capture)
    window.addEventListener('dragstart', this.preventNativeGesture, this.capture)
  }

  private readonly removeWindowGestureListeners = () => {
    window.removeEventListener('pointermove', this.onPointerMove, this.capture)
    window.removeEventListener('pointerup', this.onPointerUp, this.capture)
    window.removeEventListener('pointercancel', this.onPointerCancel, this.capture)
    window.removeEventListener('selectstart', this.preventNativeGesture, this.capture)
    window.removeEventListener('dragstart', this.preventNativeGesture, this.capture)
  }

  private readonly endActiveGesture = () => {
    releasePointerCapture(this.captureTarget, this.activeGesture?.pointerId ?? null)
    this.captureTarget = null
    this.activeGesture = null
    this.removeWindowGestureListeners()
  }

  private readonly cancelGestureIfDisabled = () => {
    if (this.options?.enabled !== false) {
      return false
    }

    this.cancelActiveGesture()
    return true
  }

  private readonly getActiveGestureForEvent = (event: PointerEvent) => {
    const gesture = this.activeGesture
    if (gesture?.pointerId !== event.pointerId) {
      return null
    }

    if (this.cancelGestureIfDisabled()) {
      return null
    }

    return gesture
  }

  private readonly onPointerDown = (event: PointerEvent) => {
    const currentOptions = this.options
    if (!currentOptions?.enabled || this.activeGesture !== null || event.button !== 0) {
      return
    }

    const pane = this.getPane()
    const target = classifyCanvasPointerTarget(event.target, pane)
    if (
      target.kind === 'outside' ||
      target.kind === 'connection-handle' ||
      target.kind === 'resize-handle'
    ) {
      return
    }

    if (currentOptions.activeTool === 'select' && target.kind === 'node') {
      this.beginNodeDragGesture(event, target, currentOptions)
      return
    }

    if (currentOptions.activeTool === 'select' && target.kind === 'pane') {
      claimCanvasPointerEvent(event)
      this.beginSelectionGesture(
        event,
        target,
        currentOptions.activeTool,
        createRectangleSelectionGesture(currentOptions, this.interaction),
      )
      return
    }

    if (currentOptions.activeTool === 'lasso' && target.kind !== 'blocked-interactive-child') {
      claimCanvasPointerEvent(event)
      this.beginSelectionGesture(
        event,
        target,
        currentOptions.activeTool,
        createLassoSelectionGesture(currentOptions, this.interaction),
      )
      return
    }

    if (
      !currentOptions.activeToolHandlers.onPointerDown ||
      target.kind === 'blocked-interactive-child'
    ) {
      return
    }

    currentOptions.activeToolHandlers.onPointerDown(event)
    this.captureTarget = setPointerCapture(event)
    this.activeGesture = {
      kind: 'tool',
      pointerId: event.pointerId,
      handlers: currentOptions.activeToolHandlers,
    }
    this.addWindowGestureListeners()
  }

  private readonly beginNodeDragGesture = (
    event: PointerEvent,
    target: Extract<CanvasPointerTarget, { kind: 'node' }>,
    options: CanvasPointerRouterOptions,
  ) => {
    const controller = options.nodeDragController
    if (!controller || !controller.begin(target.nodeId, event)) {
      return
    }

    claimCanvasPointerEvent(event)
    this.captureTarget = setPointerCapture(event)
    this.activeGesture = {
      kind: 'node-drag',
      nodeId: target.nodeId,
      pointerId: event.pointerId,
      controller,
      source: target.source,
      startPoint: { x: event.clientX, y: event.clientY },
    }
    this.addWindowGestureListeners()
  }

  private readonly beginSelectionGesture = (
    event: PointerEvent,
    target: CanvasPointerTarget,
    activeTool: CanvasToolId,
    controller: ReturnType<typeof createCanvasSelectionGestureController>,
  ) => {
    const input = this.getPointerInput(event)
    controller.begin(input, isPrimarySelectionModifier(event) ? 'add' : 'replace')
    this.captureTarget = setPointerCapture(event)
    this.activeGesture = {
      kind: 'selection',
      pointerId: event.pointerId,
      activeTool,
      startTargetKind: target.kind,
      controller,
      startPoint: input.clientPoint,
      lastPoint: input.clientPoint,
    }
    this.addWindowGestureListeners()
  }

  private readonly onPointerMove = (event: PointerEvent) => {
    const gesture = this.getActiveGestureForEvent(event)
    if (!gesture) {
      return
    }

    if (gesture.kind === 'selection') {
      claimCanvasPointerEvent(event)
      gesture.lastPoint = { x: event.clientX, y: event.clientY }
      gesture.controller.update(this.getPointerInput(event))
      return
    }

    if (gesture.kind === 'node-drag') {
      claimCanvasPointerEvent(event)
      gesture.controller.update(event)
      return
    }

    gesture.handlers.onPointerMove?.(event)
  }

  private readonly onPointerUp = (event: PointerEvent) => {
    const gesture = this.getActiveGestureForEvent(event)
    if (!gesture) {
      return
    }

    if (gesture.kind === 'selection') {
      claimCanvasPointerEvent(event)
      const committed = gesture.controller.commit(this.getPointerInput(event))
      if (!committed) {
        this.maybeClearSelectionFromPointGesture(event, gesture)
      }
      if (gesture.activeTool === 'lasso') {
        requireOptions(this.options).setActiveTool('select')
      }
      this.endActiveGesture()
      return
    }

    if (gesture.kind === 'node-drag') {
      claimCanvasPointerEvent(event)
      gesture.controller.commit(event)
      this.maybeToggleSelectionOverlayNodeFromPointGesture(event, gesture)
      this.endActiveGesture()
      return
    }

    gesture.handlers.onPointerUp?.(event)
    this.endActiveGesture()
  }

  private readonly onPointerCancel = (event: PointerEvent) => {
    const gesture = this.activeGesture
    if (gesture?.pointerId !== event.pointerId) {
      return
    }

    if (gesture.kind === 'selection') {
      claimCanvasPointerEvent(event)
      gesture.controller.cancel()
    } else if (gesture.kind === 'node-drag') {
      claimCanvasPointerEvent(event)
      gesture.controller.cancel(event)
    } else {
      gesture.handlers.onPointerCancel?.(event)
    }
    this.endActiveGesture()
  }

  private readonly onClickCapture = (event: MouseEvent) => {
    if (!this.suppressNextClick) {
      return
    }

    this.suppressNextClick = false
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation?.()
  }

  private readonly onKeyDown = (event: KeyboardEvent) => {
    const currentOptions = this.options
    if (!currentOptions?.enabled) {
      return
    }

    currentOptions.activeToolHandlers.onKeyDown?.(event)
    this.refreshActiveSelectionGestureForShiftKey(event)
  }

  private readonly onKeyUp = (event: KeyboardEvent) => {
    const currentOptions = this.options
    if (!currentOptions?.enabled) {
      return
    }

    currentOptions.activeToolHandlers.onKeyUp?.(event)
    this.refreshActiveSelectionGestureForShiftKey(event)
  }

  private readonly refreshActiveSelectionGestureForShiftKey = (event: KeyboardEvent) => {
    const gesture = this.activeGesture
    if (event.key !== 'Shift' || gesture?.kind !== 'selection') {
      return
    }

    gesture.controller.refresh(this.getPointerInput(eventAsPointerLike(event, gesture.lastPoint)))
  }

  private readonly preventNativeGesture = (event: Event) => {
    if (this.activeGesture === null) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
  }

  private readonly maybeClearSelectionFromPointGesture = (
    event: PointerEvent,
    gesture: Extract<ActivePointerGesture, { kind: 'selection' }>,
  ) => {
    const currentOptions = requireOptions(this.options)
    if (isPrimarySelectionModifier(event)) {
      return
    }

    if (
      (currentOptions.activeTool === 'select' || currentOptions.activeTool === 'lasso') &&
      gesture.startTargetKind === 'pane' &&
      distance(gesture.startPoint, { x: event.clientX, y: event.clientY }) <=
        MIN_POINT_GESTURE_DISTANCE
    ) {
      currentOptions.selection.clearSelection()
    }
  }

  private readonly maybeToggleSelectionOverlayNodeFromPointGesture = (
    event: PointerEvent,
    gesture: Extract<ActivePointerGesture, { kind: 'node-drag' }>,
  ) => {
    if (
      gesture.source !== 'selection-overlay' ||
      !isPrimarySelectionModifier(event) ||
      distance(gesture.startPoint, { x: event.clientX, y: event.clientY }) >
        MIN_POINT_GESTURE_DISTANCE
    ) {
      return
    }

    const currentOptions = requireOptions(this.options)
    currentOptions.selection.toggleNode(gesture.nodeId, true)
  }
}

const MIN_POINT_GESTURE_DISTANCE = 1

function classifyCanvasPointerTarget(
  target: EventTarget | null,
  pane: HTMLElement | null,
): CanvasPointerTarget {
  if (!(target instanceof Element) || !pane?.contains(target)) {
    return { kind: 'outside' }
  }

  if (target.closest('.canvas-selection-resize-zone')) {
    return { kind: 'resize-handle' }
  }

  if (target.closest('[data-canvas-node-handle="true"]')) {
    return { kind: 'connection-handle' }
  }

  if (isBlockedInteractiveChild(target)) {
    return { kind: 'blocked-interactive-child' }
  }

  if (target.closest('[data-canvas-edge-id]')) {
    return { kind: 'edge' }
  }

  const selectionDragTarget = target.closest<HTMLElement>('[data-canvas-selection-drag-node-id]')
  if (selectionDragTarget?.dataset.canvasSelectionDragNodeId) {
    return {
      kind: 'node',
      nodeId: selectionDragTarget.dataset.canvasSelectionDragNodeId,
      source: 'selection-overlay',
    }
  }

  const node = target.closest<HTMLElement>('.canvas-node-shell')
  if (node?.dataset.nodeId) {
    return { kind: 'node', nodeId: node.dataset.nodeId, source: 'node-shell' }
  }

  if (isCanvasEmptyPaneTarget(target, pane)) {
    return { kind: 'pane' }
  }

  return { kind: 'outside' }
}

const INTERACTIVE_CHILD_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[contenteditable]:not([contenteditable="false"])',
].join(',')

function isBlockedInteractiveChild(target: Element) {
  const richTextEditor = target.closest('.canvas-text-editor')
  if (richTextEditor) {
    return Boolean(richTextEditor.closest('.nodrag, .nopan'))
  }

  if (target.closest(INTERACTIVE_CHILD_SELECTOR)) {
    return true
  }

  return false
}

function createRectangleSelectionGesture(
  options: CanvasPointerRouterOptions,
  interaction: CanvasInteractionTools,
) {
  return createCanvasSelectionGestureController({
    strategy: createRectangleSelectionStrategy({
      viewport: options.viewportController,
      getCanvasSnapshot: () => getCanvasSelectionSnapshot(options.canvasEngine),
      getAwareness: () => options.awareness,
      localOverlay: options.localOverlay,
    }),
    getSelection: () => options.selection,
    interaction,
    requestAnimationFrame,
    cancelAnimationFrame,
  })
}

function createLassoSelectionGesture(
  options: CanvasPointerRouterOptions,
  interaction: CanvasInteractionTools,
) {
  return createCanvasSelectionGestureController({
    strategy: createLassoSelectionStrategy({
      viewport: options.viewportController,
      getCanvasSnapshot: () => getCanvasSelectionSnapshot(options.canvasEngine),
      getAwareness: () => options.awareness,
      localOverlay: options.localOverlay,
    }),
    getSelection: () => options.selection,
    interaction,
    requestAnimationFrame,
    cancelAnimationFrame,
  })
}

function getCanvasSelectionSnapshot(canvasEngine: CanvasEngine) {
  const snapshot = canvasEngine.getSnapshot()
  return {
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    measuredNodes: getMeasuredCanvasNodesFromEngineSnapshot(snapshot),
  }
}

function claimCanvasPointerEvent(event: PointerEvent) {
  event.preventDefault()
  event.stopPropagation()
}

function setPointerCapture(event: PointerEvent): Element | null {
  if (!(event.target instanceof Element)) {
    return null
  }

  try {
    event.target.setPointerCapture(event.pointerId)
  } catch {
    return null
  }
  return event.target
}

function releasePointerCapture(target: Element | null, pointerId: number | null) {
  if (!target || pointerId === null) {
    return
  }

  try {
    target.releasePointerCapture(pointerId)
  } catch {
    // Pointer capture may already be released by the browser.
  }
}

function createPointerCancelEvent(pointerId: number): PointerEvent {
  if (typeof PointerEvent !== 'undefined') {
    return new PointerEvent('pointercancel', { bubbles: true, pointerId })
  }

  // Edge runtimes only need pointerId on this fallback; other PointerEvent fields are unavailable.
  const event = new Event('pointercancel', { bubbles: true }) as PointerEvent
  Object.defineProperty(event, 'pointerId', { value: pointerId })
  return event
}

function eventAsPointerLike(
  event: KeyboardEvent,
  fallbackPoint: { x: number; y: number },
): PointerEvent {
  return {
    clientX: fallbackPoint.x,
    clientY: fallbackPoint.y,
    shiftKey: event.shiftKey,
  } as PointerEvent
}

function requireOptions(options: CanvasPointerRouterOptions | null) {
  if (!options) {
    throw new Error('CanvasPointerRouter options must be set before routing pointer events')
  }
  return options
}

function distance(left: { x: number; y: number }, right: { x: number; y: number }) {
  return Math.hypot(right.x - left.x, right.y - left.y)
}
