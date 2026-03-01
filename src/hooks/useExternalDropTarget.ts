import { useEffect, useState } from 'react'
import { dropTargetForExternal } from '@atlaskit/pragmatic-drag-and-drop/external/adapter'
import { containsFiles } from '@atlaskit/pragmatic-drag-and-drop/external/file'
import type { RefObject } from 'react'
import type { Id } from 'convex/_generated/dataModel'

export function useExternalDropTarget({
  ref,
  parentId,
  canAcceptFiles,
}: {
  ref: RefObject<HTMLElement | null>
  parentId: Id<'folders'> | undefined
  canAcceptFiles: boolean
}) {
  const [isFileDropTarget, setIsFileDropTarget] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || !canAcceptFiles) {
      setIsFileDropTarget(false)
      return
    }

    // Override the document-level 'none' dropEffect set by the global prevention
    // listener. This runs in bubble phase (after the capture-phase global listener),
    // so it wins and shows the copy/accept cursor over this element.
    const handleDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return
      for (const type of e.dataTransfer.types) {
        if (type === 'Files') {
          e.dataTransfer.dropEffect = 'copy'
          return
        }
      }
    }
    el.addEventListener('dragover', handleDragOver)

    const cleanupDropTarget = dropTargetForExternal({
      element: el,
      canDrop: ({ source }) => containsFiles({ source }),
      getData: () => ({ parentId }),
      onDragEnter: () => setIsFileDropTarget(true),
      onDragLeave: () => setIsFileDropTarget(false),
      onDrop: () => setIsFileDropTarget(false),
    })

    return () => {
      el.removeEventListener('dragover', handleDragOver)
      cleanupDropTarget()
      setIsFileDropTarget(false)
    }
  }, [ref, parentId, canAcceptFiles])

  return { isFileDropTarget }
}
