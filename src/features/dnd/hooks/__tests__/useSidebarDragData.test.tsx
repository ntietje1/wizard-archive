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

describe('useSidebarDragData', () => {
  beforeEach(() => {
    resetSidebarUIStore()
    vi.mocked(useSidebarItems).mockReset()
  })

  it('keeps operation ids normalized while exposing raw selected ids for the overlay', () => {
    const folder = createFolder()
    const firstChild = createNote({ parentId: folder._id })
    const secondChild = createNote({ parentId: folder._id })
    const activeItems = [folder, firstChild, secondChild]

    vi.mocked(useSidebarItems).mockImplementation((location) => ({
      ...(location === SIDEBAR_ITEM_LOCATION.sidebar
        ? sidebarItemsValue(activeItems)
        : sidebarItemsValue([])),
    }))
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
})
