import { useEffect, useRef, useState } from 'react'
import { dropTargetForExternal } from '@atlaskit/pragmatic-drag-and-drop/external/adapter'
import { containsFiles } from '@atlaskit/pragmatic-drag-and-drop/external/file'
import { useDndRuntimeDropData } from './context'
import type { ExternalFileDropTargetCapability } from './external-file-drop-target'
import { canAcceptExternalFileDropTarget } from './external-file-drop-target'
import {
  isBlockedExternalDropEvent,
  isBlockedExternalDropInput,
} from './external-drop-blocked-target'

export function useExternalDropTarget({
  data,
  enabled,
  fileDropTarget,
  blockedTargetSelector,
}: {
  data: Record<string, unknown>
  enabled: boolean
  fileDropTarget: ExternalFileDropTargetCapability
  blockedTargetSelector?: string
}) {
  const scopedData = useDndRuntimeDropData(data)
  const canAcceptFiles = enabled && canAcceptExternalFileDropTarget(fileDropTarget)
  const [isFileDropTarget, setIsFileDropTarget] = useState(false)
  const [element, setElement] = useState<HTMLElement | null>(null)
  const externalDropTargetRef = useRef((node: HTMLElement | null) => {
    setElement(node)
  })
  const dataRef = useRef(scopedData)
  dataRef.current = scopedData

  useEffect(() => {
    if (!element || !canAcceptFiles) {
      setIsFileDropTarget(false)
      return
    }

    // Override the document-level 'none' dropEffect set by the global prevention
    // listener. This runs in capture on the target element, after document capture
    // but before editor children can stop propagation.
    const handleDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return
      if (e.dataTransfer.types.includes('Files')) {
        if (isBlockedExternalDropEvent(e, element, blockedTargetSelector)) return
        e.dataTransfer.dropEffect = 'copy'
      }
    }
    element.addEventListener('dragover', handleDragOver, true)

    const cleanupDropTarget = dropTargetForExternal({
      element,
      canDrop: ({ source, input }) =>
        containsFiles({ source }) &&
        (!blockedTargetSelector ||
          !isBlockedExternalDropInput(element, input, blockedTargetSelector)),
      getData: () => dataRef.current,
      onDragEnter: () => setIsFileDropTarget(true),
      onDragLeave: () => setIsFileDropTarget(false),
      onDrop: () => setIsFileDropTarget(false),
    })

    return () => {
      element.removeEventListener('dragover', handleDragOver, true)
      cleanupDropTarget()
      setIsFileDropTarget(false)
    }
  }, [blockedTargetSelector, canAcceptFiles, element])

  return { externalDropTargetRef: externalDropTargetRef.current, isFileDropTarget }
}
