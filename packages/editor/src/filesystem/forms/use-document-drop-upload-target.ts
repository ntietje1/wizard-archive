import type { DragEvent } from 'react'

export function useDocumentDropUploadTarget(onFileDrop: (file: File) => void) {
  return {
    onDragOver(event: DragEvent<HTMLElement>) {
      if (!isFileDragEvent(event)) return
      event.preventDefault()
    },
    onDrop(event: DragEvent<HTMLElement>) {
      if (!isFileDragEvent(event)) return
      event.preventDefault()
      const droppedFile = event.dataTransfer.files[0]
      if (droppedFile) onFileDrop(droppedFile)
    },
  }
}

function isFileDragEvent(event: DragEvent<HTMLElement>) {
  if ((event.dataTransfer?.files.length ?? 0) > 0) return true
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}
