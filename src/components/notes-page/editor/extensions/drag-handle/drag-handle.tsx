import {
  DragHandleMenu,
  type DragHandleMenuProps,
  RemoveBlockItem,
} from '@blocknote/react'

export const CustomDragHandleMenu = (props: DragHandleMenuProps) => (
  <DragHandleMenu {...props}>
    <RemoveBlockItem {...props}>Delete</RemoveBlockItem>
  </DragHandleMenu>
)
