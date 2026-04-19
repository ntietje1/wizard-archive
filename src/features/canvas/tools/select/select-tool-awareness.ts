import type { Bounds } from '../../utils/canvas-geometry-utils'
import type { CanvasAwarenessPresenceWriter } from '../canvas-tool-types'
import type { RemoteUser, SelectingState } from '../../utils/canvas-awareness-types'

const SELECT_TOOL_AWARENESS_NAMESPACE = 'tool.select'

type RectSelectingState = Extract<SelectingState, { type: 'rect' }>

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isRectSelectingState(value: unknown): value is RectSelectingState {
  const width = (value as { width?: unknown }).width
  const height = (value as { height?: unknown }).height

  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as { type?: unknown }).type === 'rect' &&
    isFiniteNumber((value as { x?: unknown }).x) &&
    isFiniteNumber((value as { y?: unknown }).y) &&
    isFiniteNumber(width) &&
    width >= 0 &&
    isFiniteNumber(height) &&
    height >= 0
  )
}

export function readRemoteSelectRectState(remoteUser: RemoteUser): RectSelectingState | null {
  const selecting = remoteUser.presence[SELECT_TOOL_AWARENESS_NAMESPACE]
  return isRectSelectingState(selecting) ? selecting : null
}

export function setSelectToolAwareness(writer: CanvasAwarenessPresenceWriter, rect: Bounds | null) {
  writer.setPresence(SELECT_TOOL_AWARENESS_NAMESPACE, rect ? { type: 'rect', ...rect } : null)
}
