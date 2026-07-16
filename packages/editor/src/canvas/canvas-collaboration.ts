import type { ContentCollaboration } from '../resources/content-session-contract'
import type { CanvasPoint } from './interaction-types'

const MAX_CURSOR_COORDINATE = 1_000_000

type CanvasRemoteCursor = Readonly<{
  clientId: number
  point: CanvasPoint
  user: Readonly<{ color: string; name: string }>
}>

export function setCanvasCollaborationCursor(
  collaboration: ContentCollaboration,
  point: CanvasPoint | null,
): void {
  collaboration.provider.awareness.setLocalStateField('cursor', point)
}

export function readCanvasRemoteCursors(
  collaboration: ContentCollaboration,
): Array<CanvasRemoteCursor> {
  const awareness = collaboration.provider.awareness
  const cursors: Array<CanvasRemoteCursor> = []
  for (const [clientId, state] of awareness.getStates()) {
    if (clientId === awareness.doc.clientID) continue
    const cursor = parseRemoteCursor(clientId, state)
    if (cursor) cursors.push(cursor)
  }
  return cursors.sort((left, right) => left.clientId - right.clientId)
}

function parseRemoteCursor(clientId: number, value: unknown): CanvasRemoteCursor | null {
  if (!isRecord(value) || !isRecord(value.cursor) || !isRecord(value.user)) return null
  const { x, y } = value.cursor
  const { color, name } = value.user
  if (
    !isCursorCoordinate(x) ||
    !isCursorCoordinate(y) ||
    typeof color !== 'string' ||
    color.length === 0 ||
    typeof name !== 'string' ||
    name.trim().length === 0
  ) {
    return null
  }
  return { clientId, point: { x, y }, user: { color, name: name.trim() } }
}

function isCursorCoordinate(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_CURSOR_COORDINATE
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
