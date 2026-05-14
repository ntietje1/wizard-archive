import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useItemSurfaceRegistration } from '../useItemSurfaceRegistration'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { resetSidebarUIStore } from '~/test/helpers/store-helpers'
import { testId } from '~/test/helpers/test-id'

beforeEach(() => {
  resetSidebarUIStore()
})

describe('useItemSurfaceRegistration', () => {
  it('does not activate a surface on mount', () => {
    const noteId = testId<'sidebarItems'>('note_1')

    const { result, unmount } = renderHook(() =>
      useItemSurfaceRegistration({
        surface: 'trash',
        parentId: null,
        visibleItemIds: [noteId],
      }),
    )

    expect(useSidebarUIStore.getState().activeItemSurface).toBeNull()

    result.current.activateSurface()
    expect(useSidebarUIStore.getState().activeItemSurface).toEqual({
      surface: 'trash',
      parentId: null,
      visibleItemIds: [noteId],
    })

    unmount()
    expect(useSidebarUIStore.getState().activeItemSurface).toBeNull()
  })

  it('does not re-register an active surface when visible ids have the same contents', () => {
    const noteId = testId<'sidebarItems'>('note_1')
    let storeUpdates = 0
    const unsubscribe = useSidebarUIStore.subscribe(() => {
      storeUpdates += 1
    })

    expect(storeUpdates).toBe(0)

    const { result, rerender, unmount } = renderHook(
      ({ visibleItemIds }) =>
        useItemSurfaceRegistration({
          surface: 'trash',
          parentId: null,
          visibleItemIds,
        }),
      { initialProps: { visibleItemIds: [noteId] } },
    )

    result.current.activateSurface()
    expect(useSidebarUIStore.getState().activeItemSurface).toEqual({
      surface: 'trash',
      parentId: null,
      visibleItemIds: [noteId],
    })
    const updatesAfterMount = storeUpdates

    rerender({ visibleItemIds: [noteId] })

    expect(storeUpdates).toBe(updatesAfterMount)
    expect(useSidebarUIStore.getState().activeItemSurface).toEqual({
      surface: 'trash',
      parentId: null,
      visibleItemIds: [noteId],
    })

    unmount()
    expect(useSidebarUIStore.getState().activeItemSurface).toBeNull()
    unsubscribe()
  })

  it('updates the active surface when visible ids change', () => {
    const first = testId<'sidebarItems'>('note_1')
    const second = testId<'sidebarItems'>('note_2')
    let storeUpdates = 0
    const unsubscribe = useSidebarUIStore.subscribe(() => {
      storeUpdates += 1
    })

    const { result, rerender, unmount } = renderHook(
      ({ visibleItemIds }) =>
        useItemSurfaceRegistration({
          surface: 'trash',
          parentId: null,
          visibleItemIds,
        }),
      { initialProps: { visibleItemIds: [first] } },
    )
    result.current.activateSurface()
    const updatesAfterMount = storeUpdates

    rerender({ visibleItemIds: [first, second] })

    // visibleItemIds changes should produce exactly one store update beyond updatesAfterMount.
    expect(storeUpdates).toBe(updatesAfterMount + 1)
    expect(useSidebarUIStore.getState().activeItemSurface).toEqual({
      surface: 'trash',
      parentId: null,
      visibleItemIds: [first, second],
    })

    unmount()
    expect(useSidebarUIStore.getState().activeItemSurface).toBeNull()
    unsubscribe()
  })

  it('does not let a newly mounted surface steal active ownership', () => {
    const noteId = testId<'sidebarItems'>('note_1')
    const folderId = testId<'sidebarItems'>('folder_1')
    let storeUpdates = 0
    const unsubscribe = useSidebarUIStore.subscribe(() => {
      storeUpdates += 1
    })

    useSidebarUIStore.getState().setActiveItemSurface({
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: [noteId],
    })

    const { unmount } = renderHook(() =>
      useItemSurfaceRegistration({
        surface: 'folder-view',
        parentId: folderId,
        visibleItemIds: [noteId],
      }),
    )

    // Mounting registers metadata only; focus/pointer interaction is what transfers ownership.
    expect(useSidebarUIStore.getState().activeItemSurface).toEqual({
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: [noteId],
    })

    unmount()
    expect(useSidebarUIStore.getState().activeItemSurface).toEqual({
      surface: 'sidebar',
      parentId: null,
      visibleItemIds: [noteId],
    })
    unsubscribe()
  })
})
