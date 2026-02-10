import { useMemo } from 'react'
import { SidebarItem } from './sidebar-item/sidebar-item'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import { sortItemsByOptions, useAllSidebarItems } from '~/hooks/useSidebarItems'
import { useSortOptions } from '~/hooks/useSortOptions'
import { ScrollArea } from '~/components/shadcn/ui/scroll-area'

export function SidebarList() {
  const { status, parentItemsMap } = useAllSidebarItems()
  const { sortOptions } = useSortOptions()

  const rootItems: Array<AnySidebarItem> = useMemo(() => {
    const items = parentItemsMap.get(undefined) ?? []
    return sortItemsByOptions(sortOptions, items) ?? []
  }, [parentItemsMap, sortOptions])

  if (status === 'pending') {
    return null
  }

  return (
    <ScrollArea className="flex-1 min-h-0 min-w-0 w-full p-1">
      {rootItems.map((item) => (
        <SidebarItem
          key={item._id}
          item={item}
          parentItemsMap={parentItemsMap}
        />
      ))}
    </ScrollArea>
  )
}
