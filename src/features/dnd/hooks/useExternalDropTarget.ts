import { useEffect, useRef, useState } from 'react'
import { dropTargetForExternal } from '@atlaskit/pragmatic-drag-and-drop/external/adapter'
import { containsFiles } from '@atlaskit/pragmatic-drag-and-drop/external/file'
import type { RefObject } from 'react'

export function useExternalDropTarget({
  ref,
  data,
  canAcceptFiles,
}: {
  ref: RefObject<HTMLElement | null>
  data: Record<string, unknown>
  canAcceptFiles: boolean
}) {
  const [isFileDropTarget, setIsFileDropTarget] = useState(false)
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    const el = ref.current
    if (!el || !canAcceptFiles) {
      setIsFileDropTarget(false)
      return
    }

    // Override the document-level 'none' dropEffect set by the global prevention
    // listener. This runs in capture on the target element, after document capture
    // but before editor children can stop propagation.
    const handleDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return
      if (e.dataTransfer.types.includes('Files')) {
        e.dataTransfer.dropEffect = 'copy'
      }
    }
    el.addEventListener('dragover', handleDragOver, true)

    const cleanupDropTarget = dropTargetForExternal({
      element: el,
      canDrop: ({ source }) => containsFiles({ source }),
      getData: () => dataRef.current,
      onDragEnter: () => setIsFileDropTarget(true),
      onDragLeave: () => setIsFileDropTarget(false),
      onDrop: () => setIsFileDropTarget(false),
    })

    return () => {
      el.removeEventListener('dragover', handleDragOver, true)
      cleanupDropTarget()
      setIsFileDropTarget(false)
    }
  }, [ref, canAcceptFiles])

  return { isFileDropTarget }
}
