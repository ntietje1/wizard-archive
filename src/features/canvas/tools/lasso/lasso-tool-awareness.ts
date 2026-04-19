import type { CanvasAwarenessPresenceWriter } from '../canvas-tool-types'
import type { RemoteUser, SelectingState } from '../../utils/canvas-awareness-types'

const LASSO_TOOL_AWARENESS_NAMESPACE = 'tool.lasso'

type LassoSelectingState = Extract<SelectingState, { type: 'lasso' }>

function isPoint(value: unknown): value is { x: number; y: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { x?: unknown }).x === 'number' &&
    Number.isFinite((value as { x: number }).x) &&
    typeof (value as { y?: unknown }).y === 'number' &&
    Number.isFinite((value as { y: number }).y)
  )
}

function isLassoSelectingState(value: unknown): value is LassoSelectingState {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { type?: unknown }).type === 'lasso' &&
    Array.isArray((value as { points?: unknown }).points) &&
    (value as { points: Array<unknown> }).points.every(isPoint)
  )
}

export function readRemoteLassoState(remoteUser: RemoteUser): LassoSelectingState | null {
  const selecting = remoteUser.presence[LASSO_TOOL_AWARENESS_NAMESPACE]
  return isLassoSelectingState(selecting) ? selecting : null
}

export function setLassoToolAwareness(
  writer: CanvasAwarenessPresenceWriter,
  selecting: LassoSelectingState | null,
) {
  writer.setPresence(LASSO_TOOL_AWARENESS_NAMESPACE, selecting)
}
