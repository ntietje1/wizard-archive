import { useMemo } from 'react'
import type { Folder } from 'convex/folders/types'
import { useDndDropTarget } from '~/features/dnd/hooks/useDndDropTarget'

/**
 * Registers a Folder as a sidebar item drop target.
 * Delegates to useDndDropTarget for unified canDrop / highlight behavior.
 */
export function useSidebarItemDropTarget({
  ref,
  item,
}: {
  ref: React.RefObject<HTMLElement | null>
  item: Folder
}) {
  const dropData = useMemo(
    () => ({ type: item.type, sidebarItemId: item._id }),
    [item.type, item._id],
  )

  useDndDropTarget({ ref, data: dropData, highlightId: item._id })
}
