import { getCanvasEdgesMatchingRectangle } from '../../edges/canvas-edge-registry'
import { getCanvasNodesMatchingRectangle } from '../../nodes/canvas-node-selection-queries'
import { setSelectToolAwareness } from '../../tools/select/select-tool-awareness'
import { setSelectToolSelectionDragRect } from '../../tools/select/select-tool-local-overlay'
import { getConstrainedRectFromPoints } from '../../utils/canvas-constraint-utils'
import { createCanvasSelectionGestureSession } from './canvas-selection-gesture-session'
import type { getMeasuredCanvasNodesFromLookup } from '../document/canvas-measured-nodes'
import type {
  CanvasAwarenessPresenceWriter,
  CanvasInteractionTools,
  CanvasSelectionCommitMode,
  CanvasSelectionController,
} from '../../tools/canvas-tool-types'
import type { Edge, Node } from '@xyflow/react'
import type { Bounds } from '../../utils/canvas-geometry-utils'

const MIN_SELECTION_DRAG_DISTANCE_PX = 1

type ClientPoint = { x: number; y: number }
type MarqueeGestureState = {
  currentClientPoint: ClientPoint
  square: boolean
  startClientPoint: ClientPoint
}

interface CanvasSelectionGestureControllerOptions {
  viewport: {
    getZoom: () => number
    screenToCanvasPosition: (position: ClientPoint) => ClientPoint
  }
  getNodes: () => ReadonlyArray<Node>
  getEdges: () => ReadonlyArray<Edge>
  getMeasuredNodes: () => ReturnType<typeof getMeasuredCanvasNodesFromLookup>
  getAwareness: () => CanvasAwarenessPresenceWriter
  interaction: Pick<CanvasInteractionTools, 'suppressNextSurfaceClick'>
  getSelection: () => Pick<
    CanvasSelectionController,
    'beginGesture' | 'cancelGesture' | 'commitGesture' | 'getSnapshot' | 'setGesturePreview'
  >
  requestAnimationFrame: typeof requestAnimationFrame
  cancelAnimationFrame: typeof cancelAnimationFrame
}

export interface CanvasSelectionGestureController {
  begin: (point: ClientPoint, mode: CanvasSelectionCommitMode) => void
  update: (point: ClientPoint, options?: { square: boolean }) => void
  refresh: (options?: { square: boolean }) => void
  commit: (options?: { square: boolean }) => void
  cancel: () => void
  dispose: () => void
  isTracking: () => boolean
}

function boundsEqual(a: Bounds | null, b: Bounds | null): boolean {
  return a?.x === b?.x && a?.y === b?.y && a?.width === b?.width && a?.height === b?.height
}

function getFlowRect(
  viewport: Pick<CanvasSelectionGestureControllerOptions['viewport'], 'screenToCanvasPosition'>,
  state: MarqueeGestureState,
): Bounds {
  return getConstrainedRectFromPoints(
    viewport.screenToCanvasPosition(state.startClientPoint),
    viewport.screenToCanvasPosition(state.currentClientPoint),
    { square: state.square },
  )
}

export function createCanvasSelectionGestureController({
  viewport,
  getNodes,
  getEdges,
  getMeasuredNodes,
  getAwareness,
  interaction,
  getSelection,
  requestAnimationFrame,
  cancelAnimationFrame,
}: CanvasSelectionGestureControllerOptions): CanvasSelectionGestureController {
  let latestState: MarqueeGestureState | null = null
  let lastPublishedRect: Bounds | null = null

  const publishSelectToolAwareness = (rect: Bounds | null) => {
    if (boundsEqual(lastPublishedRect, rect)) {
      return
    }

    lastPublishedRect = rect
    setSelectToolAwareness(getAwareness(), rect)
  }

  const session = createCanvasSelectionGestureSession<MarqueeGestureState>({
    adapter: {
      kind: 'marquee',
      isActivated: (startState, currentState) =>
        Math.hypot(
          currentState.currentClientPoint.x - startState.startClientPoint.x,
          currentState.currentClientPoint.y - startState.startClientPoint.y,
        ) > MIN_SELECTION_DRAG_DISTANCE_PX,
      preview: (state) => {
        const flowRect = getFlowRect(viewport, state)
        setSelectToolSelectionDragRect(flowRect)
        publishSelectToolAwareness(flowRect)

        return {
          nodeIds: getCanvasNodesMatchingRectangle(getMeasuredNodes(), flowRect, {
            zoom: viewport.getZoom(),
          }),
          edgeIds: getCanvasEdgesMatchingRectangle([...getNodes()], [...getEdges()], flowRect, {
            zoom: viewport.getZoom(),
          }),
        }
      },
      clear: () => {
        setSelectToolSelectionDragRect(null)
        publishSelectToolAwareness(null)
      },
    },
    getSelection,
    interaction,
    requestAnimationFrame,
    cancelAnimationFrame,
  })

  const createState = (
    startClientPoint: ClientPoint,
    currentClientPoint: ClientPoint,
    square: boolean,
  ): MarqueeGestureState => ({
    currentClientPoint,
    square,
    startClientPoint,
  })

  return {
    begin: (point, mode) => {
      latestState = createState(point, point, false)
      session.begin(latestState, mode)
    },
    update: (point, options = { square: false }) => {
      if (!latestState) {
        return
      }

      latestState = createState(latestState.startClientPoint, point, options.square)
      session.update(latestState)
    },
    refresh: (options = { square: false }) => {
      if (!latestState) {
        return
      }

      latestState = createState(
        latestState.startClientPoint,
        latestState.currentClientPoint,
        options.square,
      )
      session.refresh(latestState)
    },
    commit: (options = { square: false }) => {
      if (!latestState) {
        return
      }

      latestState = createState(
        latestState.startClientPoint,
        latestState.currentClientPoint,
        options.square,
      )
      session.commit(latestState)
      latestState = null
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
  }
}
