import { useMemo } from 'react'
import type { Folder } from 'convex/folders/types'
import { useDndDropTarget } from '~/hooks/useDndDropTarget'
import { useAllSidebarItems } from '~/hooks/useSidebarItems'

/**
 * Registers a Folder as a sidebar item drop target and returns its ancestor IDs for UI highlighting.
 * Delegates to useDndDropTarget for unified canDrop / highlight behavior.
 */
export function useSidebarItemDropTarget({
  ref,
  item,
}: {
  ref: React.RefObject<HTMLElement | null>
  item: Folder
}) {
  const { getAncestorSidebarItems } = useAllSidebarItems()

  const ancestorIds = useMemo(
    () => getAncestorSidebarItems(item._id).map((a) => a._id),
    [item._id, getAncestorSidebarItems],
  )

  const dropData = useMemo(
    () => ({ type: item.type, sidebarItemId: item._id }),
    [item.type, item._id],
  )

  useDndDropTarget({ ref, data: dropData, highlightId: item._id })

  return { ancestorIds }
}
