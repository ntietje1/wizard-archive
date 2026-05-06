import type { CanvasHandlePosition } from '../../types/canvas-domain-types'
import type { Point2D } from '../../utils/canvas-awareness-types'

/** Endpoint metadata for a connection draft, including the node, optional handle, side, and canvas point. */
export type CanvasConnectionDraftEndpoint = {
  /** Target node id for this endpoint. */
  readonly nodeId: string
  /** Optional connection handle id within the target node. */
  readonly handleId: string | null
  /** Handle side expressed as a CanvasHandlePosition. */
  readonly position: CanvasHandlePosition
  /** Canvas-space Point2D where the endpoint is anchored. */
  readonly point: Point2D
}

/** Tracks an in-progress connection gesture from a source endpoint toward the current pointer or snap target. */
export type CanvasConnectionDraft = {
  /** Active pointer id that owns the gesture. */
  readonly pointerId: number
  /** Source CanvasConnectionDraftEndpoint where the gesture began. */
  readonly source: CanvasConnectionDraftEndpoint
  /** Current canvas-space Point2D for the free-drag preview. */
  readonly current: Point2D
  /** Snapped CanvasConnectionDraftEndpoint when hovering a valid target, otherwise null. */
  readonly snapTarget: CanvasConnectionDraftEndpoint | null
}
