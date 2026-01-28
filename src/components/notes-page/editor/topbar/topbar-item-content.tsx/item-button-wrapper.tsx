import { ContextMenuButton } from '../editor-action-buttons'
import { ShareButton } from '../share-button'
import { ViewAsPlayerButton } from '../view-as-button'
import type { ReactNode } from 'react'

export const ItemButtonWrapper = ({
  children,
}: {
  children?: ReactNode | undefined
}) => {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {children}
      <ShareButton />
      <ViewAsPlayerButton />
      <ContextMenuButton />
    </div>
  )
}
