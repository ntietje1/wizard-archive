import { DragHandleButton, SideMenu } from '@blocknote/react'
import { CustomDragHandleMenu } from '../drag-handle/drag-handle'
import ShareSideMenuButton from './share/share-side-menu-button'
import type { SideMenuProps } from '@blocknote/react'
import type {
  CustomBlockNoteEditor,
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
    <ShareSideMenuButton
      {...props}
      editor={props.editor as CustomBlockNoteEditor}
    />
    <DragHandleButton {...props} dragHandleMenu={CustomDragHandleMenu} />
  </SideMenu>
)
