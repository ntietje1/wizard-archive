import { ContextMenuButton } from '../editor-action-buttons'
import { ShareButton } from '../share-button'
import { ViewAsPlayerButton } from '../view-as-button'
import type { ReactNode } from 'react'
import type { EditorWorkspaceSource } from '../../../workspace/editor-workspace-source'

export const ItemButtonWrapper = ({
  children,
  itemActions,
  isTrashView,
  sharing,
  viewAsPlayer,
}: {
  children?: ReactNode | undefined
  itemActions: EditorWorkspaceSource['items']['itemActions']
  isTrashView?: boolean
  sharing: EditorWorkspaceSource['sharing']
  viewAsPlayer: EditorWorkspaceSource['permissions']['viewAsPlayer']
}) => {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {children}
      <ShareButton share={sharing} />
      <ViewAsPlayerButton viewAsPlayer={viewAsPlayer} />
      <ContextMenuButton itemActions={itemActions} isTrashView={isTrashView} />
    </div>
  )
}
