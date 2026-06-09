import { useLiveEditorContextMenuModel } from '../hooks/use-live-editor-context-menu-model'
import { MenuDialogs } from '../menu-dialogs'
import { EditorContextMenuSurface } from './editor-context-menu-surface'
import type { ContextMenuHostRef } from './context-menu-host'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { ViewContext } from '../types'
import type { GameMapWithContent, MapPinWithItem } from 'shared/game-maps/types'
import type { Ref } from 'react'

interface EditorContextMenuProps {
  ref?: Ref<ContextMenuHostRef>
  viewContext: ViewContext
  item?: AnySidebarItem
  isTrashView?: boolean
  children?: React.ReactNode
  className?: string
  menuClassName?: string
  disabled?: boolean
  activeMap?: GameMapWithContent
  activePin?: MapPinWithItem
  onClose?: () => void
  onDialogOpen?: () => void
  onDialogClose?: () => void
}

export function EditorContextMenu({
  ref,
  viewContext,
  item,
  isTrashView,
  children,
  className,
  menuClassName = 'w-48 z-[9999]',
  disabled = false,
  activeMap,
  activePin,
  onClose,
  onDialogOpen,
  onDialogClose,
}: EditorContextMenuProps) {
  const { dialogState, surfaceModel } = useLiveEditorContextMenuModel({
    ref,
    viewContext,
    item,
    isTrashView,
    activeMap,
    activePin,
    onDialogOpen,
    onDialogClose,
  })

  return (
    <>
      <EditorContextMenuSurface
        model={surfaceModel}
        disabled={disabled}
        className={className}
        menuClassName={menuClassName}
        onClose={onClose}
      >
        {children}
      </EditorContextMenuSurface>
      {disabled ? null : <MenuDialogs {...dialogState} />}
    </>
  )
}
