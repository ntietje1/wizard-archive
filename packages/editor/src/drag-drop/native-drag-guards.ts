export function installNativeDragGuards({
  isElementDragActive,
}: {
  isElementDragActive: () => boolean
}) {
  const isFileDrag = (event: DragEvent) => {
    if (!event.dataTransfer) return false
    return Array.from(event.dataTransfer.types).includes('Files')
  }
  const markSyntheticElementDrag = (event: DragEvent) => {
    if (isElementDragActive() && !(event.target as Element)?.closest?.('.bn-editor')) {
      ;(event as unknown as Record<string, unknown>).synthetic = true
    }
  }
  const handleDragOver = (event: DragEvent) => {
    markSyntheticElementDrag(event)
    if (!isFileDrag(event)) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'
  }
  const handleDrop = (event: DragEvent) => {
    markSyntheticElementDrag(event)
    if (isFileDrag(event)) event.preventDefault()
  }
  const isBogusLeave = (event: DragEvent) => {
    if (event.relatedTarget == null) return true
    const relatedTarget = event.relatedTarget as Node
    return 'ownerDocument' in relatedTarget && relatedTarget.ownerDocument !== document
  }
  const handleDragLeave = (event: DragEvent) => {
    if (isBogusLeave(event) && (event.target as Element)?.closest?.('.bn-editor,.tiptap')) {
      event.stopImmediatePropagation()
    }
  }

  window.addEventListener('dragleave', handleDragLeave, true)
  document.addEventListener('dragover', handleDragOver, true)
  document.addEventListener('drop', handleDrop, true)

  return () => {
    window.removeEventListener('dragleave', handleDragLeave, true)
    document.removeEventListener('dragover', handleDragOver, true)
    document.removeEventListener('drop', handleDrop, true)
  }
}
