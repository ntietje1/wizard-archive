import { useRef } from 'react'
import { SIDEBAR_ROOT_DROP_TYPE } from '../../../../drag-drop/drop-target-data'
import { resolveExternalFileDropTarget } from '../../../../drag-drop/external-file-drop-target'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { useDndDropTarget } from '../../../../drag-drop/use-drop-target'
import { useExternalDropTarget } from '../../../../drag-drop/use-external-drop-target'
import { useDndStore } from '../../../../drag-drop/store'
import { useMergedRef } from '../../../../drag-drop/ref-utils'
import { dropTargetChromeClass } from '@wizard-archive/ui/drag-drop/drop-target-visual-state'
import { useCanAcceptExternalFiles } from '../../../../drag-drop/context'

const SIDEBAR_ROOT_TARGET_DATA = { type: SIDEBAR_ROOT_DROP_TYPE } as const

interface DroppableRootProps {
  canDrop: boolean
  children: React.ReactNode
  className?: string
}

export function DroppableRoot({ canDrop, children, className }: DroppableRootProps) {
  const ref = useRef<HTMLDivElement>(null)
  const canAcceptExternalFiles = useCanAcceptExternalFiles()

  const { dropTargetRef, dropTargetKey, isDropTarget } = useDndDropTarget({
    data: SIDEBAR_ROOT_TARGET_DATA,
    canDrop,
  })

  const { externalDropTargetRef } = useExternalDropTarget({
    data: SIDEBAR_ROOT_TARGET_DATA,
    enabled: canAcceptExternalFiles && canDrop,
    fileDropTarget: resolveExternalFileDropTarget(SIDEBAR_ROOT_TARGET_DATA),
  })
  const rootDropTargetRef = useMergedRef(ref, dropTargetRef, externalDropTargetRef)

  const isDraggingFiles = useDndStore((s) => s.isDraggingFiles)
  const externalFileDropTargetKey = useDndStore((s) => s.externalFileDropTargetKey)
  const isFileDragTarget = isDraggingFiles && externalFileDropTargetKey === dropTargetKey

  return (
    <div
      ref={rootDropTargetRef}
      className={cn(
        className,
        isDropTarget && !isFileDragTarget && dropTargetChromeClass('default'),
        isFileDragTarget && dropTargetChromeClass('file'),
      )}
    >
      {children}
    </div>
  )
}
