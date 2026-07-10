import { useWorkspaceContextMenuModelSource } from '../context-menu-model-source'
import { ContextMenuSurface } from '../../context-menu/components/surface'
import type { ContextMenuHostRef } from '../../context-menu/components/host'
import type { AnyItem } from '../items'
import type { ViewContext, WorkspaceMenuContext } from '../menu-context'
import type { Ref } from 'react'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'

const DEFAULT_WORKSPACE_CONTEXT_MENU_CLASS_NAME = 'w-48 z-[9999]'

interface WorkspaceContextMenuProps {
  ref?: Ref<ContextMenuHostRef>
  viewContext: ViewContext
  item?: AnyItem
  children?: React.ReactNode
  className?: string
  contextOverrides?: Partial<WorkspaceMenuContext>
  menuClassName?: string
  disabled?: boolean
  onClose?: () => void
  onDialogOpen?: () => void
  onDialogClose?: () => void
}

export function WorkspaceContextMenu({
  ref,
  viewContext,
  item,
  children,
  className,
  contextOverrides,
  menuClassName = DEFAULT_WORKSPACE_CONTEXT_MENU_CLASS_NAME,
  disabled = false,
  onClose,
  onDialogOpen,
  onDialogClose,
}: WorkspaceContextMenuProps) {
  if (disabled) {
    return <div className={cn('relative', className)}>{children}</div>
  }

  return (
    <ModelBackedWorkspaceContextMenu
      ref={ref}
      viewContext={viewContext}
      item={item}
      contextOverrides={contextOverrides}
      className={className}
      menuClassName={menuClassName}
      onClose={onClose}
      onDialogOpen={onDialogOpen}
      onDialogClose={onDialogClose}
    >
      {children}
    </ModelBackedWorkspaceContextMenu>
  )
}

function ModelBackedWorkspaceContextMenu({
  ref,
  viewContext,
  item,
  children,
  className,
  contextOverrides,
  menuClassName = DEFAULT_WORKSPACE_CONTEXT_MENU_CLASS_NAME,
  onClose,
  onDialogOpen,
  onDialogClose,
}: Omit<WorkspaceContextMenuProps, 'disabled'>) {
  const ModelSource = useWorkspaceContextMenuModelSource()

  return (
    <ModelSource
      options={{
        ref,
        viewContext,
        item,
        contextOverrides,
        onDialogOpen,
        onDialogClose,
      }}
    >
      {({ surfaceModel }) => (
        <ContextMenuSurface
          model={surfaceModel}
          className={className}
          menuClassName={menuClassName}
          onClose={onClose}
        >
          {children}
        </ContextMenuSurface>
      )}
    </ModelSource>
  )
}
