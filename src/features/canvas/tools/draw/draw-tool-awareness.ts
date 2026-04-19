import type { CanvasAwarenessPresenceWriter } from '../canvas-tool-types'
import type { DrawingState, RemoteUser } from '../../utils/canvas-awareness-types'

const DRAW_TOOL_AWARENESS_NAMESPACE = 'tool.draw'

function isDrawingPoint(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((part) => typeof part === 'number' && Number.isFinite(part))
  )
}

function isDrawingState(value: unknown): value is DrawingState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const drawing = value as Partial<DrawingState>
  return (
    typeof drawing.color === 'string' &&
    typeof drawing.size === 'number' &&
    Number.isFinite(drawing.size) &&
    typeof drawing.opacity === 'number' &&
    Number.isFinite(drawing.opacity) &&
    Array.isArray(drawing.points) &&
    drawing.points.every(isDrawingPoint)
  )
}

export function readRemoteDrawState(remoteUser: RemoteUser): DrawingState | null {
  const drawing = remoteUser.presence[DRAW_TOOL_AWARENESS_NAMESPACE]
  return isDrawingState(drawing) ? drawing : null
}

export function setDrawToolAwareness(
  writer: CanvasAwarenessPresenceWriter,
  drawing: DrawingState | null,
) {
  writer.setPresence(DRAW_TOOL_AWARENESS_NAMESPACE, drawing)
}
