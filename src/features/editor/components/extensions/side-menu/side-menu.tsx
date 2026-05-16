import { DragHandleButton, SideMenu } from '@blocknote/react'
import { CustomDragHandleMenu } from '../drag-handle/drag-handle'
import ShareSideMenuButton from './share/share-side-menu-button'
import type { SideMenuProps } from '@blocknote/react'
import type { NoteWithContent } from 'convex/notes/types'

export const SideMenuRenderer = (props: SideMenuProps & { note: NoteWithContent }) => (
  <SideMenu {...props}>
    <ShareSideMenuButton note={props.note} />
    <DragHandleButton {...props} dragHandleMenu={CustomDragHandleMenu} />
  </SideMenu>
)
