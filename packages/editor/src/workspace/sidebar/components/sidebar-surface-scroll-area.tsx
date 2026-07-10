import type { ReactNode } from 'react'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { useItemSurfaceRegistration } from '../use-item-surface-registration'
import type { SidebarWorkspaceItemSurfaceName } from '../workspace-state'

export function SidebarSurfaceScrollArea({
  children,
  className,
  parentId,
  surface,
  visibleItemIds,
}: {
  children: ReactNode
  className?: string
  parentId: SidebarItemId | null
  surface: SidebarWorkspaceItemSurfaceName
  visibleItemIds: ReadonlyArray<SidebarItemId>
}) {
  const { activateSurface, handleSurfacePointerDown, itemSurfaceHotkeyProps } =
    useItemSurfaceRegistration({
      surface,
      parentId,
      visibleItemIds,
    })

  return (
    <ScrollArea
      className={cn('group/sidebar-surface flex-1 min-h-0 min-w-0 w-full', className)}
      onFocusCapture={activateSurface}
      onPointerDownCapture={handleSurfacePointerDown}
      onContextMenuCapture={activateSurface}
      {...itemSurfaceHotkeyProps}
    >
      {children}
    </ScrollArea>
  )
}
