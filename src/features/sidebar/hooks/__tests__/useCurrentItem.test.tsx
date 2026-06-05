import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { useCurrentItem } from '../useCurrentItem'

let routeSearch: Record<string, unknown> = {}
let activeItems: Array<AnySidebarItem> = []
let queryData: AnySidebarItem | null = null
let queryStatus: 'pending' | 'error' | 'success' = 'success'
let isFetching = false
let queryError: unknown = null

vi.mock('@tanstack/react-router', () => ({
  useMatch: () => ({ search: routeSearch }),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ campaignId: 'campaign_1' as Id<'campaigns'> }),
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: () => ({
    data: queryData,
    status: queryStatus,
    isFetching,
    error: queryError,
  }),
}))

vi.mock('~/features/sidebar/hooks/useSidebarItems', () => ({
  useActiveSidebarItems: () => ({ data: activeItems }),
}))

describe('useCurrentItem', () => {
  beforeEach(() => {
    routeSearch = {}
    activeItems = []
    queryData = null
    queryStatus = 'success'
    isFetching = false
    queryError = null
  })

  it('resolves optimistic slugs from the active sidebar cache', () => {
    const optimisticItem = createNote({
      _id: 'optimistic-create-1' as Id<'sidebarItems'>,
      name: 'Scene Draft',
      slug: 'scene-draft',
    })
    routeSearch = { item: optimisticItem.slug }
    activeItems = [optimisticItem]
    queryData = null

    const { result } = renderHook(() => useCurrentItem())

    expect(result.current.item?._id).toBe(optimisticItem._id)
    expect(result.current.contentItem).toBeNull()
    expect(result.current.isNotFound).toBe(false)
  })

  it('reports not found when a requested slug is missing', () => {
    routeSearch = { item: 'missing-slug' }

    const { result } = renderHook(() => useCurrentItem())

    expect(result.current.item).toBeNull()
    expect(result.current.isNotFound).toBe(true)
  })

  it('uses the server item after the optimistic item resolves', () => {
    const serverItem = createNote({
      _id: 'note_1' as Id<'sidebarItems'>,
      name: 'Resolved Scene',
      slug: 'resolved-scene',
    })
    routeSearch = { item: serverItem.slug }
    queryData = serverItem

    const { result } = renderHook(() => useCurrentItem())

    expect(result.current.item).toBe(serverItem)
    expect(result.current.contentItem).toBe(serverItem)
    expect(result.current.isLoading).toBe(false)
  })

  it('reports not found for an empty active cache and successful empty query', () => {
    routeSearch = { item: 'empty-slug' }
    activeItems = []
    queryData = null

    const { result } = renderHook(() => useCurrentItem())

    expect(result.current.isNotFound).toBe(true)
  })

  it('handles routes without an item slug', () => {
    routeSearch = {}

    const { result } = renderHook(() => useCurrentItem())

    expect(result.current.item).toBeNull()
    expect(result.current.hasRequestedItem).toBe(false)
    expect(result.current.isNotFound).toBe(false)
  })

  it('reports current item query errors without treating them as loading or not found', () => {
    queryError = new Error('fetch failed')
    queryStatus = 'error'
    routeSearch = { item: 'broken-slug' }

    const { result } = renderHook(() => useCurrentItem())

    expect(result.current.item).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isNotFound).toBe(false)
    expect(result.current.itemError).toBe(queryError)
  })
})
