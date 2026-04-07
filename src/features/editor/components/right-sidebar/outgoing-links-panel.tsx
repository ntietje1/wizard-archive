import { ArrowUpRight } from 'lucide-react'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'

export function OutgoingLinksPanel({
  itemId: _itemId,
}: {
  itemId: SidebarItemId
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <ArrowUpRight className="h-8 w-8 text-muted-foreground mb-2" />
      <p className="text-sm font-medium text-muted-foreground">
        Outgoing Links
      </p>
      <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
    </div>
  )
}
