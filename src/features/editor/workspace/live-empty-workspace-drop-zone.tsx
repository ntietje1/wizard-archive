import { useRef } from 'react'
import { EMPTY_EDITOR_DROP_TYPE } from '~/features/dnd/utils/drop-target-data'
import { dropTargetChromeClass } from '~/features/dnd/utils/drop-target-visual-state'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useExternalDropTarget } from '~/features/dnd/hooks/useExternalDropTarget'
import { cn } from '~/features/shadcn/lib/utils'
import type { EditorEmptyWorkspaceDropZoneProps } from './editor-workspace-source'

export function LiveEmptyWorkspaceDropZone({
  children,
  className,
}: EditorEmptyWorkspaceDropZoneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const dropData = { type: EMPTY_EDITOR_DROP_TYPE } as const

  const { isDropTarget } = useDndDropTarget({
    ref,
    data: dropData,
    highlightId: EMPTY_EDITOR_DROP_TYPE,
  })

  const { isFileDropTarget } = useExternalDropTarget({
    ref,
    data: dropData,
    canAcceptFiles: true,
  })

  return (
    <div
      ref={ref}
      className={cn(
        className,
        isDropTarget && !isFileDropTarget && dropTargetChromeClass('default'),
        isFileDropTarget && dropTargetChromeClass('file'),
      )}
    >
      {children}
    </div>
  )
}
