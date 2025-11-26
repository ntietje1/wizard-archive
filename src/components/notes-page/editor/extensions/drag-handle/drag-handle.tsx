import {
  DragHandleMenu,
  type DragHandleMenuProps,
  RemoveBlockItem,
} from '@blocknote/react'
import type { CustomBlockSchema, CustomInlineContentSchema, CustomStyleSchema } from '~/lib/editor-schema'

export const CustomDragHandleMenu = (props: DragHandleMenuProps<CustomBlockSchema, CustomInlineContentSchema, CustomStyleSchema>) => (
  <DragHandleMenu {...props}>
    <RemoveBlockItem {...props}>Delete</RemoveBlockItem>
  </DragHandleMenu>
)
