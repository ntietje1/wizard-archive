import { parseCanvasDrawAwarenessState } from 'convex/canvases/validation'
import type { CanvasAwarenessPresenceWriter } from '../canvas-tool-types'
import type { DrawingState, RemoteUser } from '../../utils/canvas-awareness-types'

const DRAW_TOOL_AWARENESS_NAMESPACE = 'tool.draw'

export function readRemoteDrawState(remoteUser: RemoteUser): DrawingState | null {
  const drawing = remoteUser.presence[DRAW_TOOL_AWARENESS_NAMESPACE]
  return parseCanvasDrawAwarenessState(drawing)
}

export function setDrawToolAwareness(writer: CanvasAwarenessPresenceWriter, drawing: unknown) {
  if (drawing === null) {
    writer.setPresence(DRAW_TOOL_AWARENESS_NAMESPACE, null)
    return
  }

  const parsedDrawing = parseCanvasDrawAwarenessState(drawing)
  if (parsedDrawing) {
    writer.setPresence(DRAW_TOOL_AWARENESS_NAMESPACE, parsedDrawing)
    return
  }

  console.warn('Ignoring invalid draw tool awareness payload', drawing)
}
