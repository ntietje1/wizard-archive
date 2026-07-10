import type { ReactNode } from 'react'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import { FileSidebar } from './sidebar'
import { WorkspaceContextMenu } from '../../context-menu/context-menu'
import type { SidebarTreeSource } from './sidebar-tree-source'

interface FileSidebarPanelProps {
  bottomPanel?: ReactNode | null
  className?: string
  footerActions?: ReactNode
  layout: 'fixed' | 'fill'
  railEndControls?: ReactNode
  railStartControls?: ReactNode
  sidebarTreeSource: SidebarTreeSource
  showPanelDivider: boolean
  topEndControls?: ReactNode
  toolbarActions?: ReactNode
  topStartControls?: ReactNode
}

export function FileSidebarPanel({
  bottomPanel = null,
  className,
  footerActions = null,
  layout,
  railEndControls = null,
  railStartControls = null,
  sidebarTreeSource,
  showPanelDivider,
  topEndControls = null,
  toolbarActions = null,
  topStartControls = null,
}: FileSidebarPanelProps) {
  const hasRailControls = Boolean(railStartControls || railEndControls)

  return (
    <nav
      aria-label="Sidebar"
      className={cn(
        'flex h-full flex-col bg-background',
        layout === 'fixed' && 'w-72 shrink-0 border-r',
        className,
      )}
    >
      <div className="h-full flex flex-col bg-background">
        <div className="shrink-0 flex items-center py-0.5 px-0.5 gap-0.5">
          {topStartControls}
          {toolbarActions}
          <div className="flex-1" />
          {topEndControls}
        </div>
        <div className="flex-1 flex min-h-0">
          {hasRailControls && (
            <>
              <div className="shrink-0 flex flex-col items-center px-0.5 space-y-1">
                {railStartControls}
                <div className="flex-1" />
                {railEndControls && <div className="shrink-0">{railEndControls}</div>}
              </div>
              {showPanelDivider && <div className="w-[1px] bg-border" />}
            </>
          )}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 border-t">
            <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
              <WorkspaceContextMenu
                viewContext="sidebar"
                className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden"
              >
                <FileSidebar source={sidebarTreeSource} />
                {footerActions && <div className="shrink-0 border-t p-1">{footerActions}</div>}
                {bottomPanel && (
                  <>
                    <div className="shrink-0 border-t" />
                    {bottomPanel}
                  </>
                )}
              </WorkspaceContextMenu>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
