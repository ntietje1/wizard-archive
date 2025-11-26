import {
  DragHandleButton,
  SideMenu,
  type SideMenuProps,
} from '@blocknote/react'
import ShareSideMenuButton from './share/share-side-menu-button'
import TagSideMenuButton from './tags/tag-side-menu-button'
import { CustomDragHandleMenu } from '../drag-handle/drag-handle'
import type {
  CustomBlockSchema,
  CustomInlineContentSchema,
  CustomStyleSchema,
} from '~/lib/editor-schema'

export const SideMenuRenderer = (
  props: SideMenuProps<
    CustomBlockSchema,
    CustomInlineContentSchema,
    CustomStyleSchema
  >,
) => (
  <SideMenu {...props}>
    <ShareSideMenuButton {...props} />
    <TagSideMenuButton {...props} />
    <DragHandleButton {...props} dragHandleMenu={CustomDragHandleMenu} />
  </SideMenu>
)
