import { useMemo } from 'react'
import { useLiveQuery } from '@tanstack/react-db'
import { SidebarItem } from './sidebar-item/sidebar-item'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import { sortItemsByOptions, useAllSidebarItems } from '~/hooks/useSidebarItems'
import { useSortOptions } from '~/hooks/useSortOptions'
import { useSidebarItemsCollection } from '~/contexts/SidebarItemsCollectionContext'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'

export function SidebarList() {
  const collection = useSidebarItemsCollection()
  const { itemsMap } = useAllSidebarItems()
  const { sortOptions } = useSortOptions()

  const liveResult = useLiveQuery(
    (q) => {
      if (!collection) return undefined
      return q.from({ item: collection }).fn.where((row) => {
        const item = row.item
        return (
          item.parentId === undefined ||
          (item.parentId !== undefined && !itemsMap.has(item.parentId))
        )
      })
    },
    [collection, itemsMap],
  )

  const rootItems: Array<AnySidebarItem> = useMemo(() => {
    return sortItemsByOptions(sortOptions, liveResult?.data) ?? []
  }, [liveResult?.data, sortOptions])

  if (!collection) {
    return null
  }

  return (
    <ScrollArea className="flex-1 min-h-0 min-w-0 w-full p-1">
      {rootItems.map((item) => (
        <SidebarItem key={item._id} item={item} />
      ))}
    </ScrollArea>
  )
}
