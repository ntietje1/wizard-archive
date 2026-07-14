import { Link2, Link2Off } from 'lucide-react'
import type { WorkspaceNavigation } from '../../runtime'
import type { ItemLinksCapability } from '../../../filesystem/search'
import type { ResourceContentSource } from '../../../filesystem/resource-content-source'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { WorkspaceContextMenu } from '../../context-menu/context-menu'
import { toast } from 'sonner'
import { handleError } from '../../../errors/handle-error'

type NavigateToItem = WorkspaceNavigation['openItem']
type ItemLinksState = ReturnType<
  Extract<ItemLinksCapability, { status: 'available' }>['getItemLinks']
>
type ItemLink = Extract<ItemLinksState, { status: 'success' }>['links'][number]

export function LinkListPanel({
  rows,
  emptyTitle,
  emptyDescription,
  onNavigate,
  resourceContent,
}: {
  rows: Array<ItemLink>
  emptyTitle: string
  emptyDescription: string
  onNavigate: NavigateToItem
  resourceContent: ResourceContentSource
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Link2 className="size-8 text-muted-foreground mb-2" aria-hidden="true" />
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
            <LinkListRow
              key={row.id}
              row={row}
              onNavigate={onNavigate}
              resourceContent={resourceContent}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

function LinkListRow({
  row,
  onNavigate,
  resourceContent,
}: {
  row: ItemLink
  onNavigate: NavigateToItem
  resourceContent: ResourceContentSource
}) {
  const label = row.item?.name || row.displayName || row.query
  const item = row.item

  if (!item) {
    return (
      <div className="flex w-full items-start gap-2.5 px-3 py-2 text-left">
        <Link2Off className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">Unresolved link</p>
        </div>
      </div>
    )
  }

  const button = (
    <button
      type="button"
      className={cn(
        'flex w-full items-start gap-2.5 px-3 py-2 text-left',
        'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      )}
      onClick={() => {
        void (async () => {
          try {
            const result = await onNavigate(item.id)
            if (result.status === 'unavailable') {
              toast.error('Unable to open linked item')
            }
          } catch (error) {
            handleError(error, 'Unable to open linked item')
          }
        })()
      }}
    >
      <Link2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{label}</p>
        {row.displayName && row.displayName !== item.name && (
          <p className="truncate text-xs text-muted-foreground">{row.displayName}</p>
        )}
      </div>
    </button>
  )

  const contextItem =
    resourceContent.status === 'available' ? resourceContent.resolveItem(item.id) : null

  return contextItem ? (
    <WorkspaceContextMenu viewContext="search-results" item={contextItem}>
      {button}
    </WorkspaceContextMenu>
  ) : (
    button
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
      <Link2Off className="size-8 text-muted-foreground mb-2" aria-hidden="true" />
      <p className="text-sm font-medium text-muted-foreground">Failed to load {label}</p>
    </div>
  )
}
