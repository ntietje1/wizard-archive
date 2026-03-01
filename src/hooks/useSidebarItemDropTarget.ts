import { useMemo, useRef } from 'react'
import type { Folder } from 'convex/folders/types'
import type { SidebarDragData } from '~/lib/dnd-utils'
import { validateDrop } from '~/lib/dnd-utils'
import { useDroppable } from '~/hooks/useDroppable'
import { useAllSidebarItems } from '~/hooks/useSidebarItems'

/**
 * Registers a Folder as a sidebar item drop target and returns its ancestor IDs for UI highlighting.
 * Handles context lookup, canDrop validation, and drop payload construction internally.
 */
export function useSidebarItemDropTarget({
  ref,
  item,
}: {
  ref: React.RefObject<HTMLElement | null>
  item: Folder
}) {
  const { itemsMap, getAncestorSidebarItems } = useAllSidebarItems()

  const ancestorIds = useMemo(
    () => getAncestorSidebarItems(item._id).map((a) => a._id),
    [item._id, getAncestorSidebarItems],
  )

  // Use refs so the canDrop closure always reads latest values without needing
  // to be re-created on every render (useDroppable stabilises the callback via its own ref)
  const itemRef = useRef(item)
  itemRef.current = item
  const ancestorIdsRef = useRef(ancestorIds)
  ancestorIdsRef.current = ancestorIds
  const itemsMapRef = useRef(itemsMap)
  itemsMapRef.current = itemsMap

  const dropData = useMemo(
    () => ({ type: item.type, sidebarItemId: item._id }),
    [item.type, item._id],
  )

  useDroppable<typeof dropData, SidebarDragData>({
    ref,
    data: dropData,
    canDrop: (sourceData) => {
      const draggedItem =
        itemsMapRef.current.get(sourceData.sidebarItemId) ?? null
      return validateDrop(draggedItem, {
        ...itemRef.current,
        ancestorIds: ancestorIdsRef.current,
      }).valid
    },
  })

  return { ancestorIds }
}
