import { useRef, useState } from 'react'
import type { DragEvent } from 'react'

const MULTIPLE_FILE_DROP_ERROR = 'Drop one file at a time'

export function useFileDropControl(
  onFileDrop: (file: File) => void,
  options: { onDropRejected?: (message: string) => void } = {},
) {
  const [isDragActive, setIsDragActive] = useState(false)
  const dragDepthRef = useRef(0)

  const handleDrag = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    if (event.type === 'dragenter') {
      dragDepthRef.current += 1
      setIsDragActive(true)
      return
    }

    if (event.type === 'dragleave') {
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
      setIsDragActive(dragDepthRef.current > 0)
      return
    }

    if (event.type === 'dragover' && dragDepthRef.current > 0) {
      setIsDragActive(true)
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current = 0
    setIsDragActive(false)

    const files = event.dataTransfer.files
    if (files.length > 1) {
      options.onDropRejected?.(MULTIPLE_FILE_DROP_ERROR)
      return
    }

    const [firstFile] = files
    if (firstFile) {
      onFileDrop(firstFile)
    }
  }

  return {
    handleDrag,
    handleDrop,
    isDragActive,
  }
}
