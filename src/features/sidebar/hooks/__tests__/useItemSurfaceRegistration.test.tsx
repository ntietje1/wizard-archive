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
  it('does not re-register a surface when visible ids have the same contents', () => {
    const noteId = testId<'sidebarItems'>('note_1')
    let storeUpdates = 0
    const unsubscribe = useSidebarUIStore.subscribe(() => {
      storeUpdates += 1
    })

    const { rerender, unmount } = renderHook(
      ({ visibleItemIds }) =>
        useItemSurfaceRegistration({
          surface: 'trash',
          parentId: null,
          visibleItemIds,
        }),
      { initialProps: { visibleItemIds: [noteId] } },
    )

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
    unsubscribe()
  })
})
