export function isCanvasEmptyPaneTarget(
  target: EventTarget | null,
  pane: HTMLElement | null,
): boolean {
  if (!(target instanceof Element) || !pane?.contains(target)) {
    return false
  }

  if (target === pane) {
    return true
  }

  if (
    target.closest('.canvas-node-shell') ||
    target.closest('.canvas-node-resize-handle') ||
    target.closest('[data-canvas-node-handle="true"]') ||
    target.closest('[data-canvas-edge-id]')
  ) {
    return false
  }

  return (
    target.closest('[data-canvas-viewport="true"]') !== null ||
    target.closest('[data-canvas-edge-layer="true"]') !== null
  )
}
