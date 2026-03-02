import { ContextMenuButton } from '../editor-action-buttons'
import { ShareButton } from '../share-button'
import { ViewAsPlayerButton } from '../view-as-button'
import type { ReactNode } from 'react'

export const ItemButtonWrapper = ({
  children,
  isTrashView,
}: {
  children?: ReactNode | undefined
  isTrashView?: boolean
}) => {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {children}
      {!isTrashView && <ShareButton />}
      {!isTrashView && <ViewAsPlayerButton />}
      <ContextMenuButton isTrashView={isTrashView} />
    </div>
  )
}
