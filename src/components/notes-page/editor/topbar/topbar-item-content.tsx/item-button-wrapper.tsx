import { BookmarkButton } from '../bookmark-button'
import { ContextMenuButton } from '../editor-action-buttons'
import type { ReactNode } from 'react'

export const ItemButtonWrapper = ({
  children,
}: {
  children?: ReactNode | undefined
}) => {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {children}
      <BookmarkButton />
      <ContextMenuButton />
    </div>
  )
}
