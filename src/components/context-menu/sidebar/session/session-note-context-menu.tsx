import {
  TagNoteContextMenu,
  type TagNoteContextMenuProps,
} from '../generic/tag-note-context-menu'
import { forwardRef } from 'react'
import type { ContextMenuRef } from '~/components/context-menu/base/context-menu'

export const SessionNoteContextMenu = forwardRef<
  ContextMenuRef,
  TagNoteContextMenuProps
>(({ children, noteWithTag, categoryConfig, ...props }, ref) => {
  return (
    <TagNoteContextMenu
      ref={ref}
      noteWithTag={noteWithTag}
      categoryConfig={categoryConfig}
      {...props}
    >
      {children}
    </TagNoteContextMenu>
  )
})

