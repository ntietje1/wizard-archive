import type { Folder } from 'convex/folders/types'
import { canDropFilesOnTarget } from '~/features/dnd/utils/drop-target-data'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'
import { useExternalDropTarget } from '~/features/dnd/hooks/useExternalDropTarget'
import { useDndStore } from '~/features/dnd/stores/dnd-store'

export function useSidebarItemDropTarget({
  ref,
  item,
}: {
  ref: React.RefObject<HTMLElement | null>
  item: Folder
}) {
  const dropData = { type: item.type, sidebarItemId: item._id }
  const { isDropTarget } = useDndDropTarget({ ref, data: dropData, highlightId: item._id })

  useExternalDropTarget({
    ref,
    parentId: item._id,
    canAcceptFiles: canDropFilesOnTarget(item),
  })

  const isTrashAction = useDndStore(
    (s) => s.dragOutcome?.type === 'operation' && s.dragOutcome.action === 'trash',
  )
  const isFileDropTarget = useDndStore((s) => s.isDraggingFiles && s.fileDragHoveredId === item._id)

  return { isDropTarget, isTrashAction, isFileDropTarget }
}
