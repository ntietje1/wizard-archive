import { ContextMenuHost } from './context-menu-host'
import type { ContextMenuHostRef } from './context-menu-host'
import type { BuiltContextMenu } from '../types'
import type { Ref } from 'react'

export interface EditorContextMenuSurfaceModel {
  hostRef: Ref<ContextMenuHostRef>
  menu: BuiltContextMenu
}

interface EditorContextMenuSurfaceProps {
  children?: React.ReactNode
  className?: string
  disabled?: boolean
  menuClassName?: string
  model: EditorContextMenuSurfaceModel
  onClose?: () => void
}

export function EditorContextMenuSurface({
  children,
  className,
  disabled = false,
  menuClassName = 'w-48 z-[9999]',
  model,
  onClose,
}: EditorContextMenuSurfaceProps) {
  if (disabled) return children

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
