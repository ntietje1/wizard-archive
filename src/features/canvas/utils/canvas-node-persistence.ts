import type { CanvasNode as Node } from '~/features/canvas/types/canvas-domain-types'

export function stripEphemeralCanvasNodeState<TNode extends Node>(
  node: TNode,
): Omit<TNode, 'selected' | 'draggable' | 'dragging' | 'resizing'> {
  const {
    selected: _selected,
    draggable: _draggable,
    dragging: _dragging,
    resizing: _resizing,
    ...persistedNode
  } = node

  return persistedNode
}
