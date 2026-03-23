import { DragHandleButton, SideMenu } from '@blocknote/react'
import { CustomDragHandleMenu } from '../drag-handle/drag-handle'
import ShareSideMenuButton from './share/share-side-menu-button'
import type { SideMenuProps } from '@blocknote/react'

export const SideMenuRenderer = (props: SideMenuProps) => (
  <SideMenu {...props}>
    <ShareSideMenuButton />
    <DragHandleButton {...props} dragHandleMenu={CustomDragHandleMenu} />
  </SideMenu>
)
