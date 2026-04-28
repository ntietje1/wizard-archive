import type { CanvasDocumentNode } from '~/features/canvas/types/canvas-domain-types'

export function stripEphemeralCanvasNodeState(node: CanvasDocumentNode): CanvasDocumentNode
export function stripEphemeralCanvasNodeState(node: unknown): unknown
export function stripEphemeralCanvasNodeState(node: unknown): unknown {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return node
  }

  const {
    selected: _selected,
    draggable: _draggable,
    dragging: _dragging,
    resizing: _resizing,
    ...documentNode
  } = node as Record<string, unknown>
  return documentNode
}
