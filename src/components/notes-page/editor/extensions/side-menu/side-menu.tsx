import { DragHandleButton, SideMenu } from '@blocknote/react'
import ShareSideMenuButton from './share/share-side-menu-button'
import TagSideMenuButton from './tags/tag-side-menu-button'
import { CustomDragHandleMenu } from '../drag-handle/drag-handle'

export const SideMenuRenderer = (props: any) => (
  <SideMenu {...props}>
    <ShareSideMenuButton {...props} />
    <TagSideMenuButton {...props} />
    <DragHandleButton {...props} dragHandleMenu={CustomDragHandleMenu} />
  </SideMenu>
)
