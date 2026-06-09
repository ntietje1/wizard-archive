import { ContextMenuButton } from '../editor-action-buttons'
import { ShareButton } from '../share-button'
import { ViewAsPlayerButton } from '../view-as-button'
import type { ReactNode } from 'react'
import type { EditorWorkspaceTopbarChrome } from '../../../workspace/editor-workspace-chrome'

export const ItemButtonWrapper = ({
  children,
  chrome,
  isTrashView,
}: {
  children?: ReactNode | undefined
  chrome: EditorWorkspaceTopbarChrome
  isTrashView?: boolean
}) => {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {children}
      <ShareButton share={chrome.share} />
      <ViewAsPlayerButton viewAsPlayer={chrome.viewAsPlayer} />
      <ContextMenuButton contextMenu={chrome.contextMenu} isTrashView={isTrashView} />
    </div>
  )
}
