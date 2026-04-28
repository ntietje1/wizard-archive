import type { CanvasHandlePosition } from '../../types/canvas-domain-types'
import type { Point2D } from '../../utils/canvas-awareness-types'

/** Endpoint metadata for a connection draft, including the node, optional handle, side, and canvas point. */
type CanvasConnectionDraftEndpoint = {
  /** Target node id for this endpoint. */
  nodeId: string
  /** Optional connection handle id within the target node. */
  handleId: string | null
  /** Handle side expressed as a CanvasHandlePosition. */
  position: CanvasHandlePosition
  /** Canvas-space Point2D where the endpoint is anchored. */
  point: Point2D
}

/** Tracks an in-progress connection gesture from a source endpoint toward the current pointer or snap target. */
export type CanvasConnectionDraft = {
  /** Active pointer id that owns the gesture. */
  pointerId: number
  /** Source CanvasConnectionDraftEndpoint where the gesture began. */
  source: CanvasConnectionDraftEndpoint
  /** Current canvas-space Point2D for the free-drag preview. */
  current: Point2D
  /** Snapped CanvasConnectionDraftEndpoint when hovering a valid target, otherwise null. */
  snapTarget: CanvasConnectionDraftEndpoint | null
}
