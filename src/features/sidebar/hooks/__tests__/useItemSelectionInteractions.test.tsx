import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MouseEvent } from 'react'
import { useItemSelectionInteractions } from '../useItemSelectionInteractions'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { resetSidebarUIStore } from '~/test/helpers/store-helpers'
import { createNote } from '~/test/factories/sidebar-item-factory'

beforeEach(() => {
  resetSidebarUIStore()
})

function clickEvent(modifiers: Partial<MouseEvent> = {}) {
  return {
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    preventDefault: vi.fn(),
    ...modifiers,
  } as unknown as MouseEvent
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
})
