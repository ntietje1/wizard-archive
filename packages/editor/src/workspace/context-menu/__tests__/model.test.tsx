import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vite-plus/test'
import { RESOURCE_STATUS } from '../../items-persistence-contract'
import type { AnyItem } from '../../items'
import { VIEW_CONTEXT } from '../../view-context'
import type { ViewContext } from '../../menu-context'
import { useWorkspaceContextMenuBase } from '../../context-menu-model'
import { createResourceCatalogModel } from '../../../filesystem/catalog'
import { createFolder, createNote } from '../../../test/sidebar-item-factory'

describe('useWorkspaceContextMenuBase', () => {
  it('normalizes selected sidebar items through operation item resolution', () => {
    const folder = createFolder({ name: 'Folder' })
    const child = createNote({ name: 'Child', parentId: folder.id })
    const sibling = createNote({ name: 'Sibling' })

    const { result } = renderModel({
      activeItems: [folder, child, sibling],
      selectedItemIds: [folder.id, child.id, sibling.id],
      item: child,
      viewContext: VIEW_CONTEXT.SIDEBAR,
    })

    expect(contextItemIds(result.current.menuContext.primaryItem)).toEqual([folder.id])
    expect(contextItemIds(result.current.menuContext.selectedItems)).toEqual([
      folder.id,
      sibling.id,
    ])
  })

  it('uses the clicked item when it is outside the active sidebar selection', () => {
    const selected = createNote({ name: 'Selected' })
    const clicked = createNote({ name: 'Clicked' })

    const { result } = renderModel({
      activeItems: [selected, clicked],
      selectedItemIds: [selected.id],
      item: clicked,
      viewContext: VIEW_CONTEXT.SIDEBAR,
    })

    expect(contextItemIds(result.current.menuContext.primaryItem)).toEqual([clicked.id])
    expect(contextItemIds(result.current.menuContext.selectedItems)).toEqual([clicked.id])
  })

  it('uses operation item ids when they include the clicked item', () => {
    const unselected = createNote({ name: 'Unselected' })
    const providerSelected = createNote({ name: 'Provider selected' })
    const clicked = createNote({ name: 'Clicked' })

    const { result } = renderModel({
      activeItems: [unselected, providerSelected, clicked],
      selectedItemIds: [providerSelected.id, clicked.id],
      item: clicked,
      viewContext: VIEW_CONTEXT.SIDEBAR,
    })

    expect(contextItemIds(result.current.menuContext.primaryItem)).toEqual([providerSelected.id])
    expect(contextItemIds(result.current.menuContext.selectedItems)).toEqual([
      providerSelected.id,
      clicked.id,
    ])
  })

  it('falls back to the clicked primary item when operation ids resolve no items', () => {
    const clicked = createNote({ name: 'Clicked' })

    const { result } = renderModel({
      activeItems: [],
      selectedItemIds: [clicked.id],
      item: clicked,
      viewContext: VIEW_CONTEXT.SIDEBAR,
    })

    expect(contextItemIds(result.current.menuContext.primaryItem)).toEqual([clicked.id])
    expect(contextItemIds(result.current.menuContext.selectedItems)).toEqual([])
  })

  it('resolves selected trash-view items through operation item resolution', () => {
    const trashed = createNote({ name: 'Trashed', status: RESOURCE_STATUS.trashed })

    const { result } = renderModel({
      activeItems: [],
      trashItems: [trashed],
      selectedItemIds: [trashed.id],
      item: trashed,
      viewContext: VIEW_CONTEXT.TRASH_VIEW,
    })

    expect(contextItemIds(result.current.menuContext.primaryItem)).toEqual([trashed.id])
    expect(contextItemIds(result.current.menuContext.selectedItems)).toEqual([trashed.id])
    expect(result.current.menuContext.primaryItem?.isTrashed).toBe(true)
  })

  it('uses the clicked sidebar item as the operation target on map view surfaces', () => {
    const pinnedItem = createNote({ name: 'Pinned note' })

    const { result } = renderModel({
      activeItems: [],
      selectedItemIds: [],
      item: pinnedItem,
      viewContext: VIEW_CONTEXT.MAP_VIEW,
    })

    expect(result.current.menuContext.item).toBe(pinnedItem)
    expect(result.current.menuContext.primaryItem).toBe(pinnedItem)
    expect(result.current.menuContext.selectedItems).toEqual([pinnedItem])
  })

  it('normalizes an empty surface context to an explicit empty selection', () => {
    const { result } = renderModel({
      activeItems: [],
      selectedItemIds: [],
      viewContext: VIEW_CONTEXT.SIDEBAR,
    })

    expect(result.current.menuContext.selectedItems).toEqual([])
  })
})

function contextItemIds(items: AnyItem | Array<AnyItem> | undefined) {
  return (Array.isArray(items) ? items : items ? [items] : []).map((item) => item.id)
}

function renderModel({
  activeItems,
  item,
  selectedItemIds,
  trashItems = [],
  viewContext,
}: {
  activeItems: Array<AnyItem>
  item?: AnyItem
  selectedItemIds: Array<AnyItem['id']>
  trashItems?: Array<AnyItem>
  viewContext: ViewContext
}) {
  return renderHook(() =>
    useWorkspaceContextMenuBase({
      itemSource: createItemSource({
        activeItems,
        trashItems,
        selectedItemIds,
      }),
      options: { item, viewContext },
    }),
  )
}

function createItemSource({
  activeItems,
  trashItems = [],
  selectedItemIds,
}: {
  activeItems: Array<AnyItem>
  trashItems?: Array<AnyItem>
  selectedItemIds: Array<AnyItem['id']>
}) {
  const { operationItems } = createResourceCatalogModel({ activeItems, trashItems })
  return {
    selectedItemIds,
    resolveOperationItems: operationItems.resolveItems,
  }
}
