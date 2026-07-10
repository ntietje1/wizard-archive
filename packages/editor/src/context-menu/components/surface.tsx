import { ContextMenuHost } from './host'
import type { ContextMenuHostRef } from './host'
import type { BuiltContextMenu } from '../types'
import type { Ref } from 'react'
import { cn } from '@wizard-archive/ui/shadcn/lib/utils'

export interface ContextMenuSurfaceModel {
  hostRef: Ref<ContextMenuHostRef>
  menu: BuiltContextMenu
}

interface ContextMenuSurfaceProps {
  children?: React.ReactNode
  className?: string
  disabled?: boolean
  menuClassName?: string
  model: ContextMenuSurfaceModel
  onClose?: () => void
}

export function ContextMenuSurface({
  children,
  className,
  disabled = false,
  menuClassName = 'w-48 z-[9999]',
  model,
  onClose,
}: ContextMenuSurfaceProps) {
  if (disabled) {
    return <div className={cn('relative w-full', className)}>{children}</div>
  }

  return (
    <ContextMenuHost
      ref={model.hostRef}
      menu={model.menu}
      className={className}
      menuClassName={menuClassName}
      onClose={onClose}
    >
      {children}
    </ContextMenuHost>
  )
}
