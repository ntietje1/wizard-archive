import type { FolderItem } from '../workspace/items'
import { resolveExternalFileDropTarget } from './external-file-drop-target'
import { useDndDropTarget } from './use-drop-target'
import { useExternalDropTarget } from './use-external-drop-target'
import { useDndStore } from './store'
import { useCanAcceptExternalFiles } from './context'
import { useMergedRef } from './ref-utils'

export function useSidebarItemDropTarget({
  ref,
  item,
  canDrop = true,
}: {
  ref: React.RefObject<HTMLElement | null>
  item: FolderItem
  canDrop?: boolean
}) {
  const canAcceptExternalFiles = useCanAcceptExternalFiles()
  const dropData = { type: item.type, sidebarItemId: item.id }
  const { dropTargetRef, dropTargetKey, isDropTarget } = useDndDropTarget({
    data: dropData,
    canDrop,
  })

  const { externalDropTargetRef } = useExternalDropTarget({
    data: dropData,
    enabled: canAcceptExternalFiles && canDrop,
    fileDropTarget: resolveExternalFileDropTarget(item),
  })
  const mergedDropTargetRef = useMergedRef(ref, dropTargetRef, externalDropTargetRef)

  const isTrashAction = useDndStore(
    (s) =>
      s.activeDropTargetKey === dropTargetKey &&
      s.dragOutcome?.type === 'operation' &&
      s.dragOutcome.action === 'trash',
  )
  const isFileDropTarget = useDndStore(
    (s) => canDrop && s.isDraggingFiles && s.externalFileDropTargetKey === dropTargetKey,
  )

  return {
    dropTargetRef: mergedDropTargetRef,
    dropTargetKey,
    isDropTarget,
    isTrashAction,
    isFileDropTarget,
  }
}
