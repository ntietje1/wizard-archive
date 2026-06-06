import { Link2, Link2Off } from 'lucide-react'
import type { FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { assertSidebarItemSlug } from 'shared/sidebar-items/slug'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { cn } from '~/features/shadcn/lib/utils'

type LinkPanelRow = FunctionReturnType<typeof api.links.queries.getOutgoingLinkPanelRows>[number]
type NavigateToItem = ReturnType<typeof useEditorNavigation>['navigateToItem']

export function LinkListPanel({
  rows,
  emptyTitle,
  emptyDescription,
}: {
  rows: Array<LinkPanelRow>
  emptyTitle: string
  emptyDescription: string
}) {
  const { navigateToItem } = useEditorNavigation()

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Link2 className="h-8 w-8 text-muted-foreground mb-2" aria-hidden="true" />
        <p className="text-sm font-medium text-muted-foreground">{emptyTitle}</p>
        <p className="text-xs text-muted-foreground mt-1">{emptyDescription}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 min-h-0">
        <div className="py-1">
          {rows.map((row) => (
            <LinkListRow key={row._id} row={row} onNavigate={navigateToItem} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

function LinkListRow({ row, onNavigate }: { row: LinkPanelRow; onNavigate: NavigateToItem }) {
  const label = row.item?.name || row.displayName || row.query
  const item = row.item

  if (!item) {
    return (
      <div className="flex w-full items-start gap-2.5 px-3 py-2 text-left">
        <Link2Off className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">Unresolved link</p>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-start gap-2.5 px-3 py-2 text-left',
        'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      )}
      onClick={() => onNavigate(assertSidebarItemSlug(item.slug))}
    >
      <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{label}</p>
        {row.displayName && row.displayName !== item.name && (
          <p className="truncate text-xs text-muted-foreground">{row.displayName}</p>
        )}
      </div>
    </button>
  )
}

export function LinkPanelLoading({ label }: { label: string }) {
  return (
    <div className="flex flex-col h-full">
      <p className="text-sm text-muted-foreground p-4 text-center">Loading {label}...</p>
    </div>
  )
}

export function LinkPanelError({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <Link2Off className="h-8 w-8 text-muted-foreground mb-2" aria-hidden="true" />
      <p className="text-sm font-medium text-muted-foreground">Failed to load {label}</p>
    </div>
  )
}
