import { SideMenu } from '@blocknote/react'
import { BlockDragHandleButton } from './drag-handle/block-drag-handle-button'
import ShareSideMenuButton from './share/share-side-menu-button'
import type { SideMenuProps } from '@blocknote/react'
import type { NoteWithContent } from 'shared/notes/types'

export const SideMenuRenderer = (props: SideMenuProps & { note: NoteWithContent }) => (
  <SideMenu {...props}>
    <ShareSideMenuButton note={props.note} />
    <BlockDragHandleButton note={props.note} />
  </SideMenu>
)
