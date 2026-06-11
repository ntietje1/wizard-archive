import { ChevronDown, ChevronRight, Eye, Lock, MoreVertical, Plus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { EditorTopbarSurface } from '~/features/editor/components/topbar/editor-topbar-surface'
import { cn } from '~/features/shadcn/lib/utils'
import { SidebarRow } from '~/features/sidebar/components/sidebar-row'
import type { KeyboardEvent, ReactNode } from 'react'

export function DemoEditorTopbar({ title }: { title: ReactNode }) {
  return (
    <EditorTopbarSurface
      title={title}
      timestampControl={
        <span className="h-auto shrink-0 px-1.5 py-0.5 text-xs text-muted-foreground">
          Edited today
        </span>
      }
      middleContent={<DemoEditorTopbarActions />}
    />
  )
}

export function DemoSidebarFooter({
  campaignName,
  onOpenCreateDashboard,
}: {
  campaignName: string
  onOpenCreateDashboard?: () => void
}) {
  return (
    <>
      <div className="shrink-0 border-t p-1">
        <DemoSidebarActionRow icon={Plus} label="New" onClick={onOpenCreateDashboard} />
      </div>
      <div className="shrink-0 border-t" />
      <div className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-item-hover">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{campaignName}</span>
        <span className="size-2 shrink-0 rounded-full bg-feedback-success" aria-hidden="true" />
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
    </>
  )
}

function DemoEditorTopbarActions() {
  return (
    <div className="flex shrink-0 items-center gap-1" aria-hidden="true">
      <span className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground">
        <Lock className="size-3.5" />
        <span className="text-xs">Private</span>
        <ChevronDown className="size-3 text-muted-foreground" />
      </span>
      <span
        className="inline-flex size-8 items-center justify-center rounded-md text-sm font-medium"
        title="View as player"
      >
        <Eye className="size-4" />
      </span>
      <span
        className="inline-flex size-8 items-center justify-center rounded-md text-sm font-medium"
        title="More options"
      >
        <MoreVertical className="size-4" />
      </span>
    </div>
  )
}

function DemoSidebarActionRow({
  icon,
  label,
  onClick,
  rightSlot,
}: {
  icon: LucideIcon
  label: string
  onClick?: () => void
  rightSlot?: ReactNode
}) {
  const interactive = onClick !== undefined
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || (event.key !== 'Enter' && event.key !== ' ')) return
    event.preventDefault()
    onClick()
  }

  return (
    <SidebarRow
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      icon={icon}
      label={label}
      rightSlot={rightSlot}
      className={cn('select-none', interactive && 'cursor-pointer')}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    />
  )
}
