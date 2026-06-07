export function shouldPreventExternalFileDrop(event: DragEvent): boolean {
  const isFileDrag = event.dataTransfer?.types.includes('Files') ?? false
  if (!isFileDrag) return false

  const target = event.target
  if (target instanceof Element && target.closest('[data-note-embed-drop-target="true"]')) {
    return false
  }

  return true
}
