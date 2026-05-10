import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useItemSelectionInteractions } from '../useItemSelectionInteractions'
import type { ItemSelectionModifierState } from '~/features/sidebar/utils/item-selection-intent'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { resetSidebarUIStore } from '~/test/helpers/store-helpers'
import { createNote } from '~/test/factories/sidebar-item-factory'

beforeEach(() => {
  resetSidebarUIStore()
})

function clickEvent(
  modifiers: Partial<ItemSelectionModifierState> = {},
): ItemSelectionModifierState & { preventDefault: () => void } {
  const event = new MouseEvent('click', {
    shiftKey: modifiers.shiftKey ?? false,
    metaKey: modifiers.metaKey ?? false,
    ctrlKey: modifiers.ctrlKey ?? false,
  })
  return {
    shiftKey: event.shiftKey,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
    preventDefault: () => undefined,
  }
}

describe('useItemSelectionInteractions', () => {
  it('optimistically marks a plain-clicked item as viewed before open navigation finishes', () => {
    const item = createNote({ slug: 'target-note' })
    const onOpen = vi.fn()
    const { result } = renderHook(() =>
      useItemSelectionInteractions(item, {
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [item._id],
      }),
    )

    act(() => {
      result.current.handleItemClick(clickEvent(), onOpen)
    })

    expect(useSidebarUIStore.getState().selectedSlug).toBe(item.slug)
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([item._id])
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('does not update the viewed slug for range selection clicks', () => {
    const first = createNote({ slug: 'first-note' })
    const second = createNote({ slug: 'second-note' })
    useSidebarUIStore.getState().setSelected(first.slug)
    useSidebarUIStore.getState().selectSingleItem(first._id)
    const { result } = renderHook(() =>
      useItemSelectionInteractions(second, {
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [first._id, second._id],
      }),
    )

    act(() => {
      result.current.handleItemClick(clickEvent({ shiftKey: true }))
    })

    expect(useSidebarUIStore.getState().selectedSlug).toBe(first.slug)
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([first._id, second._id])
  })

  it('does not update the viewed slug for toggle selection clicks', () => {
    const first = createNote({ slug: 'first-note' })
    const second = createNote({ slug: 'second-note' })
    useSidebarUIStore.getState().setSelected(first.slug)
    const { result } = renderHook(() =>
      useItemSelectionInteractions(second, {
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [first._id, second._id],
      }),
    )

    act(() => {
      result.current.handleItemClick(clickEvent({ ctrlKey: true }))
    })

    expect(useSidebarUIStore.getState().selectedSlug).toBe(first.slug)
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([second._id])
  })

  it('does not update the viewed slug for meta-key toggle selection clicks', () => {
    const first = createNote({ slug: 'first-note' })
    const second = createNote({ slug: 'second-note' })
    useSidebarUIStore.getState().setSelected(first.slug)
    const { result } = renderHook(() =>
      useItemSelectionInteractions(second, {
        surface: 'sidebar',
        parentId: null,
        visibleItemIds: [first._id, second._id],
      }),
    )

    act(() => {
      result.current.handleItemClick(clickEvent({ metaKey: true }))
    })

    expect(useSidebarUIStore.getState().selectedSlug).toBe(first.slug)
    expect(useSidebarUIStore.getState().selectedItemIds).toEqual([second._id])
  })
})
