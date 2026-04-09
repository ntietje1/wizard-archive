import { ArrowUpLeft } from 'lucide-react'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'

export function BackLinksPanel({ itemId: _itemId }: { itemId: SidebarItemId }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <ArrowUpLeft
        className="h-8 w-8 text-muted-foreground mb-2"
        aria-hidden="true"
      />
      <p className="text-sm font-medium text-muted-foreground">Back Links</p>
      <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
    </div>
  )
}
