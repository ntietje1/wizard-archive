export function getCanvasVisualSelectionState({
  selected,
  pendingPreviewActive,
  pendingSelected,
}: {
  selected: boolean
  pendingPreviewActive: boolean
  pendingSelected: boolean
}): {
  selected: boolean
  pendingPreviewActive: boolean
  pendingSelected: boolean
  visuallySelected: boolean
} {
  return {
    selected,
    pendingPreviewActive,
    pendingSelected,
    visuallySelected: pendingPreviewActive ? pendingSelected : selected,
  }
}
