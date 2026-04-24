import type { Node } from '@xyflow/react'

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
