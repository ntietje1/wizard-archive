import {
  getCanvasEdgesMatchingLasso,
  getCanvasEdgesMatchingRectangle,
} from '../../edges/canvas-edge-registry'
import {
  getCanvasNodesMatchingLasso,
  getCanvasNodesMatchingRectangle,
} from '../../nodes/canvas-node-selection-queries'
import { setLassoToolAwareness } from '../../tools/lasso/lasso-tool-awareness'
import { setLassoToolLocalPoints } from '../../tools/lasso/lasso-tool-local-overlay'
import { setSelectToolAwareness } from '../../tools/select/select-tool-awareness'
import { setSelectToolSelectionDragRect } from '../../tools/select/select-tool-local-overlay'
import { getConstrainedRectFromPoints } from '../../utils/canvas-constraint-utils'
import { createCanvasSelectionGestureSession } from './canvas-selection-gesture-session'
import type { getMeasuredCanvasNodesFromLookup } from '../document/canvas-measured-nodes'
import type {
  CanvasAwarenessPresenceWriter,
  CanvasInteractionTools,
  CanvasMeasuredNode,
  CanvasSelectionCommitMode,
  CanvasSelectionController,
  CanvasSelectionGestureKind,
  CanvasSelectionSnapshot,
} from '../../tools/canvas-tool-types'
import type { Bounds } from '../../utils/canvas-geometry-utils'
import type {
  CanvasEdge as Edge,
  CanvasNode as Node,
} from '~/features/canvas/types/canvas-domain-types'

const MIN_SELECTION_DRAG_DISTANCE_PX = 1

type CanvasSelectionPointerInput = {
  clientPoint: { x: number; y: number }
  canvasPoint: { x: number; y: number }
  square: boolean
}

interface CanvasSelectionGestureStrategy<TState> {
  kind: CanvasSelectionGestureKind
  startGestureOnBegin?: boolean
  createInitialState: (input: CanvasSelectionPointerInput) => TState
  updateState: (state: TState, input: CanvasSelectionPointerInput) => TState
  refreshState: (state: TState, input: CanvasSelectionPointerInput) => TState
  isActivated?: (startState: TState, currentState: TState) => boolean
  sync?: (state: TState) => void
  preview: (state: TState) => CanvasSelectionSnapshot | null
  clear: () => void
}

interface CanvasSelectionGestureControllerOptions<TState> {
  strategy: CanvasSelectionGestureStrategy<TState>
  interaction: Pick<CanvasInteractionTools, 'suppressNextSurfaceClick'>
  getSelection: () => Pick<
    CanvasSelectionController,
    'beginGesture' | 'cancelGesture' | 'commitGesture' | 'getSnapshot' | 'setGesturePreview'
  >
  requestAnimationFrame: typeof requestAnimationFrame
  cancelAnimationFrame: typeof cancelAnimationFrame
}

interface CanvasSelectionGestureController {
  begin: (input: CanvasSelectionPointerInput, mode: CanvasSelectionCommitMode) => void
  update: (input: CanvasSelectionPointerInput) => void
  refresh: (input: CanvasSelectionPointerInput) => void
  commit: (input?: CanvasSelectionPointerInput) => boolean
  cancel: () => void
  dispose: () => void
  isTracking: () => boolean
  hasRenderedPreview: () => boolean
}

export function createCanvasSelectionGestureController<TState>({
  strategy,
  interaction,
  getSelection,
  requestAnimationFrame,
  cancelAnimationFrame,
}: CanvasSelectionGestureControllerOptions<TState>): CanvasSelectionGestureController {
  let latestState: TState | null = null

  const session = createCanvasSelectionGestureSession<TState>({
    adapter: {
      kind: strategy.kind,
      startGestureOnBegin: strategy.startGestureOnBegin,
      isActivated: strategy.isActivated,
      sync: strategy.sync,
      preview: strategy.preview,
      clear: strategy.clear,
    },
    getSelection,
    interaction,
    requestAnimationFrame,
    cancelAnimationFrame,
  })

  return {
    begin: (input, mode) => {
      latestState = strategy.createInitialState(input)
      session.begin(latestState, mode)
    },
    update: (input) => {
      if (!latestState) {
        return
      }

      latestState = strategy.updateState(latestState, input)
      session.update(latestState)
    },
    refresh: (input) => {
      if (!latestState) {
        return
      }

      latestState = strategy.refreshState(latestState, input)
      session.refresh(latestState)
    },
    commit: (input) => {
      if (!latestState) {
        return false
      }

      if (input) {
        latestState = strategy.refreshState(latestState, input)
      }
      const committed = session.commit(latestState)
      latestState = null
      return committed
    },
    cancel: () => {
      session.cancel()
      latestState = null
    },
    dispose: () => {
      session.dispose()
      latestState = null
    },
    isTracking: () => session.isTracking(),
    hasRenderedPreview: () => session.hasRenderedPreview(),
  }
}

type RectangleSelectionState = {
  currentClientPoint: { x: number; y: number }
  square: boolean
  startClientPoint: { x: number; y: number }
}

export function createRectangleSelectionStrategy({
  viewport,
  getCanvasSnapshot,
  getAwareness,
}: {
  viewport: {
    getZoom: () => number
    screenToCanvasPosition: (position: { x: number; y: number }) => { x: number; y: number }
  }
  getCanvasSnapshot: () => {
    nodes: ReadonlyArray<Node>
    edges: ReadonlyArray<Edge>
    measuredNodes: ReturnType<typeof getMeasuredCanvasNodesFromLookup>
  }
  getAwareness: () => CanvasAwarenessPresenceWriter
}): CanvasSelectionGestureStrategy<RectangleSelectionState> {
  let lastPublishedRect: Bounds | null = null

  const publishSelectToolAwareness = (rect: Bounds | null) => {
    if (boundsEqual(lastPublishedRect, rect)) {
      return
    }

    lastPublishedRect = rect
    setSelectToolAwareness(getAwareness(), rect)
  }

  return {
    kind: 'marquee',
    isActivated: (startState, currentState) =>
      Math.hypot(
        currentState.currentClientPoint.x - startState.startClientPoint.x,
        currentState.currentClientPoint.y - startState.startClientPoint.y,
      ) > MIN_SELECTION_DRAG_DISTANCE_PX,
    createInitialState: (input) => ({
      currentClientPoint: input.clientPoint,
      square: input.square,
      startClientPoint: input.clientPoint,
    }),
    updateState: (state, input) => ({
      currentClientPoint: input.clientPoint,
      square: input.square,
      startClientPoint: state.startClientPoint,
    }),
    refreshState: (state, input) => ({
      ...state,
      square: input.square,
    }),
    preview: (state) => {
      const canvasRect = getCanvasRect(viewport, state)
      const canvasSnapshot = getCanvasSnapshot()
      setSelectToolSelectionDragRect(canvasRect)
      publishSelectToolAwareness(canvasRect)

      return {
        nodeIds: getCanvasNodesMatchingRectangle(canvasSnapshot.measuredNodes, canvasRect, {
          zoom: viewport.getZoom(),
        }),
        edgeIds: getCanvasEdgesMatchingRectangle(
          canvasSnapshot.nodes,
          canvasSnapshot.edges,
          canvasRect,
          {
            zoom: viewport.getZoom(),
          },
        ),
      }
    },
    clear: () => {
      setSelectToolSelectionDragRect(null)
      publishSelectToolAwareness(null)
    },
  }
}

type LassoSelectionState = {
  points: Array<{ x: number; y: number }>
}

export function createLassoSelectionStrategy({
  viewport,
  getCanvasSnapshot,
  getAwareness,
}: {
  viewport: {
    getZoom: () => number
  }
  getCanvasSnapshot: () => {
    nodes: ReadonlyArray<Node>
    edges: ReadonlyArray<Edge>
    measuredNodes: ReadonlyArray<CanvasMeasuredNode>
  }
  getAwareness: () => CanvasAwarenessPresenceWriter
}): CanvasSelectionGestureStrategy<LassoSelectionState> {
  let lastPublishedPoints: Array<{ x: number; y: number }> | null = null

  const publishLassoAwareness = (points: Array<{ x: number; y: number }> | null) => {
    if (pointsEqual(lastPublishedPoints, points)) {
      return
    }

    lastPublishedPoints = points
    setLassoToolAwareness(getAwareness(), points ? { type: 'lasso', points } : null)
  }

  return {
    kind: 'lasso',
    startGestureOnBegin: true,
    createInitialState: (input) => ({
      points: [input.canvasPoint],
    }),
    updateState: (state, input) => {
      state.points.push(input.canvasPoint)
      return state
    },
    refreshState: (state) => state,
    sync: ({ points }) => {
      setLassoToolLocalPoints([...points])
    },
    preview: ({ points }) => {
      publishLassoAwareness([...points])
      if (points.length < 3) {
        return null
      }

      const canvasSnapshot = getCanvasSnapshot()
      return {
        nodeIds: getCanvasNodesMatchingLasso(canvasSnapshot.measuredNodes, points, {
          zoom: viewport.getZoom(),
        }),
        edgeIds: getCanvasEdgesMatchingLasso(canvasSnapshot.nodes, canvasSnapshot.edges, points, {
          zoom: viewport.getZoom(),
        }),
      }
    },
    clear: () => {
      setLassoToolLocalPoints([])
      publishLassoAwareness(null)
    },
  }
}

function getCanvasRect(
  viewport: {
    screenToCanvasPosition: (position: { x: number; y: number }) => { x: number; y: number }
  },
  state: RectangleSelectionState,
): Bounds {
  return getConstrainedRectFromPoints(
    viewport.screenToCanvasPosition(state.startClientPoint),
    viewport.screenToCanvasPosition(state.currentClientPoint),
    { square: state.square },
  )
}

function boundsEqual(left: Bounds | null, right: Bounds | null): boolean {
  return (
    left?.x === right?.x &&
    left?.y === right?.y &&
    left?.width === right?.width &&
    left?.height === right?.height
  )
}

function pointsEqual(
  left: Array<{ x: number; y: number }> | null,
  right: Array<{ x: number; y: number }> | null,
) {
  if (left === right) {
    return true
  }
  if (left === null || right === null || left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index].x !== right[index].x || left[index].y !== right[index].y) {
      return false
    }
  }

  return true
}
