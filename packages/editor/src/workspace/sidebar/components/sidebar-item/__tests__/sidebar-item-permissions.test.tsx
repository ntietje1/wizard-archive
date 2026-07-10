import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { AnyItem } from '../../../../items'
import { DraggableSidebarItem } from '../draggable-sidebar-item'
import { DroppableSidebarItem } from '../droppable-sidebar-item'
import { createFolder, createNote } from '../../../../../test/sidebar-item-factory'

const draggableCalls = vi.hoisted(() => [] as Array<{ canDrag: boolean }>)
const dropTargetCalls = vi.hoisted(() => [] as Array<{ canDrop?: boolean }>)

vi.mock('../../../../../drag-drop/use-draggable', () => ({
  useDraggable: (options: { canDrag: boolean }) => {
    draggableCalls.push({ canDrag: options.canDrag })
    return { draggableRef: { current: null } }
  },
}))

vi.mock('../../../../../drag-drop/sidebar-drag-data', () => ({
  useSidebarDragData: () => ({ sidebarItemId: 'item_1', sidebarItemIds: ['item_1'] }),
}))

vi.mock('../../../../../drag-drop/store', () => ({
  useDndStore: () => false,
}))

vi.mock('../../../../../drag-drop/use-sidebar-item-drop-target', () => ({
  useSidebarItemDropTarget: (options: { canDrop?: boolean }) => {
    dropTargetCalls.push({ canDrop: options.canDrop })
    return { isDropTarget: false, isTrashAction: false, isFileDropTarget: false }
  },
}))

describe('sidebar item permission plumbing', () => {
  beforeEach(() => {
    draggableCalls.length = 0
    dropTargetCalls.length = 0
  })

  it('disables sidebar dragging when the workspace source denies mutation', () => {
    const note = createNote()

    render(
      <DraggableSidebarItem item={note} canDrag={false} dragDataSource={dragDataSource}>
        <div>Note</div>
      </DraggableSidebarItem>,
    )

    expect(draggableCalls).toEqual([{ canDrag: false }])
  })

  it('disables sidebar dragging when the row is pending', () => {
    const note = createNote()

    render(
      <DraggableSidebarItem item={note} canDrag disabled dragDataSource={dragDataSource}>
        <div>Note</div>
      </DraggableSidebarItem>,
    )

    expect(draggableCalls).toEqual([{ canDrag: false }])
  })

  it('disables folder drops when the workspace source denies mutation', () => {
    const folder = createFolder()

    render(
      <DroppableSidebarItem item={folder} canDrop={false}>
        <div>Folder</div>
      </DroppableSidebarItem>,
    )

    expect(dropTargetCalls).toEqual([{ canDrop: false }])
  })
})

const dragDataSource = {
  getSidebarDragData: (item: AnyItem) => ({
    sidebarItemId: item.id,
    sidebarItemIds: [item.id],
    dragPreviewItemIds: [item.id],
  }),
}
