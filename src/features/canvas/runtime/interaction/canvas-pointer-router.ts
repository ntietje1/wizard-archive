import { getMeasuredCanvasNodesFromEngineSnapshot } from '../document/canvas-measured-nodes'
import {
  createCanvasSelectionGestureController,
  createLassoSelectionStrategy,
  createRectangleSelectionStrategy,
} from '../selection/canvas-selection-gesture-controller'
import { isCanvasEmptyPaneTarget } from './canvas-pane-targets'
import { isPrimarySelectionModifier } from '../../utils/canvas-selection-utils'
import type { CanvasEngine } from '../../system/canvas-engine'
import type { CanvasViewportController } from '../../system/canvas-viewport-controller'
import type {
  CanvasAwarenessPresenceWriter,
  CanvasInteractionTools,
  CanvasSelectionController,
  CanvasToolHandlers,
  CanvasToolId,
} from '../../tools/canvas-tool-types'

type CanvasPointerTargetKind =
  | 'blocked-interactive-child'
  | 'connection-handle'
  | 'edge'
  | 'node'
  | 'outside'
  | 'pane'
  | 'resize-handle'

type ActivePointerGesture =
  | {
      kind: 'selection'
      pointerId: number
      startTargetKind: CanvasPointerTargetKind
      controller: ReturnType<typeof createCanvasSelectionGestureController>
      startPoint: { x: number; y: number }
      lastPoint: { x: number; y: number }
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
  >
  getShiftPressed: () => boolean
}

export interface CanvasPointerRouter {
  interaction: CanvasInteractionTools
  attach: (surfaceElement: HTMLElement | null) => () => void
  setOptions: (options: CanvasPointerRouterOptions) => void
  cancelActiveGesture: () => void
}

export function createCanvasPointerRouter(): CanvasPointerRouter {
  let options: CanvasPointerRouterOptions | null = null
  let surfaceElement: HTMLElement | null = null
  let activeGesture: ActivePointerGesture | null = null
  let captureTarget: Element | null = null
  let suppressNextClick = false
  const capture = true
  const interaction: CanvasInteractionTools = {
    suppressNextSurfaceClick: () => {
      suppressNextClick = true
    },
  }

  const getPane = () =>
    surfaceElement?.querySelector<HTMLElement>('[data-canvas-pane="true"]') ?? null

  const getPointerInput = (event: PointerEvent) => {
    const currentOptions = requireOptions(options)
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

  const addWindowGestureListeners = () => {
    window.addEventListener('pointermove', onPointerMove, capture)
    window.addEventListener('pointerup', onPointerUp, capture)
    window.addEventListener('pointercancel', onPointerCancel, capture)
    window.addEventListener('selectstart', preventNativeGesture, capture)
    window.addEventListener('dragstart', preventNativeGesture, capture)
  }

  const removeWindowGestureListeners = () => {
    window.removeEventListener('pointermove', onPointerMove, capture)
    window.removeEventListener('pointerup', onPointerUp, capture)
    window.removeEventListener('pointercancel', onPointerCancel, capture)
    window.removeEventListener('selectstart', preventNativeGesture, capture)
    window.removeEventListener('dragstart', preventNativeGesture, capture)
  }

  const endActiveGesture = () => {
    releasePointerCapture(captureTarget, activeGesture?.pointerId ?? null)
    captureTarget = null
    activeGesture = null
    removeWindowGestureListeners()
  }

  const cancelActiveGesture = () => {
    if (activeGesture?.kind === 'selection') {
      activeGesture.controller.cancel()
    } else if (activeGesture?.kind === 'tool') {
      activeGesture.handlers.onPointerCancel?.(createPointerCancelEvent(activeGesture.pointerId))
    }
    endActiveGesture()
  }

  const onPointerDown = (event: PointerEvent) => {
    const currentOptions = options
    if (!currentOptions?.enabled || activeGesture !== null || event.button !== 0) {
      return
    }

    const pane = getPane()
    const targetKind = classifyCanvasPointerTarget(event.target, pane)
    if (
      targetKind === 'outside' ||
      targetKind === 'connection-handle' ||
      targetKind === 'resize-handle'
    ) {
      return
    }

    if (currentOptions.activeTool === 'select' && targetKind === 'pane') {
      claimCanvasPointerEvent(event)
      beginSelectionGesture(
        event,
        targetKind,
        createRectangleSelectionGesture(currentOptions, interaction),
      )
      return
    }

    if (currentOptions.activeTool === 'lasso' && targetKind !== 'blocked-interactive-child') {
      claimCanvasPointerEvent(event)
      beginSelectionGesture(
        event,
        targetKind,
        createLassoSelectionGesture(currentOptions, interaction),
      )
      return
    }

    if (
      !currentOptions.activeToolHandlers.onPointerDown ||
      targetKind === 'blocked-interactive-child'
    ) {
      return
    }

    currentOptions.activeToolHandlers.onPointerDown(event)
    captureTarget = setPointerCapture(event)
    activeGesture = {
      kind: 'tool',
      pointerId: event.pointerId,
      handlers: currentOptions.activeToolHandlers,
    }
    addWindowGestureListeners()
  }

  const beginSelectionGesture = (
    event: PointerEvent,
    targetKind: CanvasPointerTargetKind,
    controller: ReturnType<typeof createCanvasSelectionGestureController>,
  ) => {
    const input = getPointerInput(event)
    controller.begin(input, isPrimarySelectionModifier(event) ? 'add' : 'replace')
    captureTarget = setPointerCapture(event)
    activeGesture = {
      kind: 'selection',
      pointerId: event.pointerId,
      startTargetKind: targetKind,
      controller,
      startPoint: input.clientPoint,
      lastPoint: input.clientPoint,
    }
    addWindowGestureListeners()
  }

  const onPointerMove = (event: PointerEvent) => {
    if (activeGesture?.pointerId !== event.pointerId) {
      return
    }

    if (activeGesture.kind === 'selection') {
      claimCanvasPointerEvent(event)
      activeGesture.lastPoint = { x: event.clientX, y: event.clientY }
      activeGesture.controller.update(getPointerInput(event))
      return
    }

    activeGesture.handlers.onPointerMove?.(event)
  }

  const onPointerUp = (event: PointerEvent) => {
    if (activeGesture?.pointerId !== event.pointerId) {
      return
    }

    if (activeGesture.kind === 'selection') {
      claimCanvasPointerEvent(event)
      const committed = activeGesture.controller.commit(getPointerInput(event))
      if (!committed) {
        maybeClearSelectionFromPointGesture(event, activeGesture)
      }
      endActiveGesture()
      return
    }

    activeGesture.handlers.onPointerUp?.(event)
    endActiveGesture()
  }

  const onPointerCancel = (event: PointerEvent) => {
    if (activeGesture?.pointerId !== event.pointerId) {
      return
    }

    if (activeGesture.kind === 'selection') {
      claimCanvasPointerEvent(event)
      activeGesture.controller.cancel()
    } else {
      activeGesture.handlers.onPointerCancel?.(event)
    }
    endActiveGesture()
  }

  const onClickCapture = (event: MouseEvent) => {
    if (!suppressNextClick) {
      return
    }

    suppressNextClick = false
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation?.()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    options?.activeToolHandlers.onKeyDown?.(event)
    if (event.key === 'Shift' && activeGesture?.kind === 'selection') {
      activeGesture.controller.refresh(
        getPointerInput(eventAsPointerLike(event, activeGesture.lastPoint)),
      )
    }
  }

  const onKeyUp = (event: KeyboardEvent) => {
    options?.activeToolHandlers.onKeyUp?.(event)
    if (event.key === 'Shift' && activeGesture?.kind === 'selection') {
      activeGesture.controller.refresh(
        getPointerInput(eventAsPointerLike(event, activeGesture.lastPoint)),
      )
    }
  }

  const preventNativeGesture = (event: Event) => {
    if (activeGesture === null) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
  }

  const maybeClearSelectionFromPointGesture = (
    event: PointerEvent,
    gesture: Extract<ActivePointerGesture, { kind: 'selection' }>,
  ) => {
    const currentOptions = requireOptions(options)
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

  return {
    interaction,
    attach: (nextSurfaceElement) => {
      surfaceElement = nextSurfaceElement
      if (!surfaceElement) {
        return () => undefined
      }

      surfaceElement.addEventListener('pointerdown', onPointerDown)
      surfaceElement.addEventListener('click', onClickCapture, true)
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('keyup', onKeyUp)

      return () => {
        surfaceElement?.removeEventListener('pointerdown', onPointerDown)
        surfaceElement?.removeEventListener('click', onClickCapture, true)
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('keyup', onKeyUp)
        cancelActiveGesture()
        surfaceElement = null
      }
    },
    setOptions: (nextOptions) => {
      options = nextOptions
    },
    cancelActiveGesture,
  }
}

const MIN_POINT_GESTURE_DISTANCE = 1

export function classifyCanvasPointerTarget(
  target: EventTarget | null,
  pane: HTMLElement | null,
): CanvasPointerTargetKind {
  if (!(target instanceof Element) || !pane?.contains(target)) {
    return 'outside'
  }

  if (target.closest('.canvas-node-resize-handle')) {
    return 'resize-handle'
  }

  if (target.closest('[data-canvas-node-handle="true"]')) {
    return 'connection-handle'
  }

  if (target.closest(INTERACTIVE_CHILD_SELECTOR)) {
    return 'blocked-interactive-child'
  }

  if (target.closest('[data-canvas-edge-id]')) {
    return 'edge'
  }

  if (target.closest('.canvas-node-shell')) {
    return 'node'
  }

  if (isCanvasEmptyPaneTarget(target, pane)) {
    return 'pane'
  }

  return 'outside'
}

const INTERACTIVE_CHILD_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  'a[href]',
  '[contenteditable="true"]',
  '.canvas-rich-text-editor',
].join(',')

function createRectangleSelectionGesture(
  options: CanvasPointerRouterOptions,
  interaction: CanvasInteractionTools,
) {
  return createCanvasSelectionGestureController({
    strategy: createRectangleSelectionStrategy({
      viewport: options.viewportController,
      getCanvasSnapshot: () => getCanvasSelectionSnapshot(options.canvasEngine),
      getAwareness: () => options.awareness,
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
