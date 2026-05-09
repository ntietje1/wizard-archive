import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { useSidebarDragData } from '~/features/dnd/hooks/useSidebarDragData'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { useSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { resetSidebarUIStore } from '~/test/helpers/store-helpers'

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useSidebarItems: vi.fn(),
}))

function sidebarItemsValue(items: Array<AnySidebarItem>) {
  return {
    data: items,
    status: 'success' as const,
    ...buildSidebarItemMaps(items),
  }
}

function mockSidebarItems(
  activeItems: Array<AnySidebarItem>,
  trashedItems: Array<AnySidebarItem> = [],
) {
  vi.mocked(useSidebarItems).mockImplementation((location) =>
    location === SIDEBAR_ITEM_LOCATION.sidebar
      ? sidebarItemsValue(activeItems)
      : sidebarItemsValue(trashedItems),
  )
}

describe('useSidebarDragData', () => {
  beforeEach(() => {
    resetSidebarUIStore()
    vi.mocked(useSidebarItems).mockReset()
  })

  it('uses only the current item when no items are selected', () => {
    const note = createNote()
    mockSidebarItems([note])

    const { result } = renderHook(() => useSidebarDragData(note))

    expect(result.current).toEqual({
      sidebarItemId: note._id,
      sidebarItemIds: [note._id],
      sidebarDragPreviewItemIds: [note._id],
    })
  })

  it('keeps single-item selections unchanged', () => {
    const note = createNote()
    mockSidebarItems([note])
    useSidebarUIStore.setState({ selectedItemIds: [note._id] })

    const { result } = renderHook(() => useSidebarDragData(note))

    expect(result.current).toEqual({
      sidebarItemId: note._id,
      sidebarItemIds: [note._id],
      sidebarDragPreviewItemIds: [note._id],
    })
  })

  it('uses only the current item when dragging outside the current selection', () => {
    const dragged = createNote()
    const selected = createNote()
    mockSidebarItems([dragged, selected])
    useSidebarUIStore.setState({ selectedItemIds: [selected._id] })

    const { result } = renderHook(() => useSidebarDragData(dragged))

    expect(result.current).toEqual({
      sidebarItemId: dragged._id,
      sidebarItemIds: [dragged._id],
      sidebarDragPreviewItemIds: [dragged._id],
    })
  })

  it('keeps unrelated selected items as separate operation ids', () => {
    const first = createNote()
    const second = createNote()
    mockSidebarItems([first, second])
    useSidebarUIStore.setState({ selectedItemIds: [first._id, second._id] })

    const { result } = renderHook(() => useSidebarDragData(first))

    expect(result.current).toEqual({
      sidebarItemId: first._id,
      sidebarItemIds: [first._id, second._id],
      sidebarDragPreviewItemIds: [first._id, second._id],
    })
  })

  it('keeps operation ids normalized while exposing raw selected ids for the overlay', () => {
    const folder = createFolder()
    const firstChild = createNote({ parentId: folder._id })
    const secondChild = createNote({ parentId: folder._id })
    const activeItems = [folder, firstChild, secondChild]

    mockSidebarItems(activeItems)
    useSidebarUIStore.setState({
      selectedItemIds: [folder._id, firstChild._id, secondChild._id],
    })

    const { result } = renderHook(() => useSidebarDragData(firstChild))

    expect(result.current).toEqual({
      sidebarItemId: firstChild._id,
      sidebarItemIds: [folder._id],
      sidebarDragPreviewItemIds: [folder._id, firstChild._id, secondChild._id],
    })
  })

  it('can include selected active and trashed items in drag data', () => {
    const active = createNote()
    const trashed = createNote({ location: SIDEBAR_ITEM_LOCATION.trash })
    mockSidebarItems([active], [trashed])
    useSidebarUIStore.setState({ selectedItemIds: [active._id, trashed._id] })

    const { result } = renderHook(() => useSidebarDragData(active))

    expect(result.current).toEqual({
      sidebarItemId: active._id,
      sidebarItemIds: [active._id, trashed._id],
      sidebarDragPreviewItemIds: [active._id, trashed._id],
    })
  })
})
