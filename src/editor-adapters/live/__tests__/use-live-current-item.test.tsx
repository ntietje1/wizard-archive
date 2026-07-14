import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Id } from 'convex/_generated/dataModel'
import type { WizardEditorItem, WizardEditorItemWithContent } from '@wizard-archive/editor/adapter'
import { testResourceId } from '../../../../shared/test/resource-id'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { EDITOR_ROUTE_ID } from '../editor-route'
import { useLiveCurrentItem } from '../use-live-current-item'

let routeSearch: Record<string, unknown> = {}
let activeItems: Array<WizardEditorItem> = []
let queryData: SidebarItemAccessResult | null = null
let queryStatus: 'pending' | 'error' | 'success' = 'success'
let isFetching = false
let queryError: unknown = null
const authQueryCalls = vi.hoisted(() => [] as Array<Array<unknown>>)
const matchCalls = vi.hoisted(() => [] as Array<unknown>)

vi.mock('@tanstack/react-router', () => ({
  useMatch: (input: unknown) => {
    matchCalls.push(input)
    return { search: routeSearch }
  },
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ campaignId: 'campaign_1' as Id<'campaigns'> }),
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: (...args: Array<unknown>) => {
    authQueryCalls.push(args)
    return {
      data: queryData,
      status: queryStatus,
      isFetching,
      error: queryError,
    }
  },
}))

describe('useLiveCurrentItem', () => {
  beforeEach(() => {
    routeSearch = {}
    activeItems = []
    queryData = null
    queryStatus = 'success'
    isFetching = false
    queryError = null
    authQueryCalls.length = 0
    matchCalls.length = 0
  })

  it('resolves an optimistic resource from the active sidebar cache', () => {
    const optimisticItem = createNote({
      id: testResourceId('optimistic-create-1'),
      name: 'Scene Draft',
    })
    routeSearch = { item: optimisticItem.id }
    activeItems = [optimisticItem]
    queryData = { status: 'not_found' }

    const { result } = renderHook(() => useLiveCurrentItem({ getKnownItemById: getActiveItemById }))

    expect(result.current.item?.id).toBe(optimisticItem.id)
    expect(matchCalls[0]).toEqual({
      from: EDITOR_ROUTE_ID,
      shouldThrow: false,
    })
  })

  it('reports not found when a requested resource is missing', () => {
    routeSearch = { item: testResourceId('missing') }

    const { result } = renderHook(() => useLiveCurrentItem({ getKnownItemById: getActiveItemById }))

    expect(result.current.isNotFound).toBe(true)
  })

  it('uses the server item after the optimistic item resolves', () => {
    const serverItem = createNote({
      id: testResourceId('note-1'),
      name: 'Resolved Scene',
    })
    routeSearch = { item: serverItem.id }
    queryData = { status: 'available', item: serverItem as WizardEditorItemWithContent }

    const { result } = renderHook(() => useLiveCurrentItem({ getKnownItemById: getActiveItemById }))

    expect(result.current.item).toMatchObject({
      id: serverItem.id,
      name: 'Resolved Scene',
    })
    expect(result.current.contentItem).toBe(result.current.item)
    expect(authQueryCalls[0]?.[1]).toEqual({
      campaignId: 'campaign_1',
      resourceId: serverItem.id,
    })
  })

  it('keeps denied server results explicit without exposing item metadata', () => {
    routeSearch = { item: testResourceId('private-scene') }
    queryData = { status: 'not_shared' }

    const { result } = renderHook(() => useLiveCurrentItem({ getKnownItemById: getActiveItemById }))

    expect(result.current.item).toBeNull()
    expect(result.current.contentItem).toBeNull()
    expect(result.current.isNotFound).toBe(false)
    expect(result.current.accessStatus).toBe('not_shared')
  })

  it('skips the current item query without a requested resource', () => {
    renderHook(() => useLiveCurrentItem({ getKnownItemById: getActiveItemById }))

    expect(authQueryCalls[0]?.[1]).toBe('skip')
  })

  it('does not reuse previous campaign item data as query placeholder content', () => {
    routeSearch = { item: testResourceId('shared') }

    renderHook(() => useLiveCurrentItem({ getKnownItemById: getActiveItemById }))

    expect(authQueryCalls[0]).toHaveLength(2)
  })

  it('prefers the resolved server item over a stale optimistic cache item', () => {
    const optimisticItem = createNote({
      id: testResourceId('optimistic-create-1'),
      name: 'Scene Draft',
    })
    const serverItem = createNote({
      id: testResourceId('note-1'),
      name: 'Resolved Scene',
    })
    routeSearch = { item: serverItem.id }
    activeItems = [optimisticItem]
    queryData = { status: 'available', item: serverItem as WizardEditorItemWithContent }

    const { result } = renderHook(() => useLiveCurrentItem({ getKnownItemById: getActiveItemById }))

    expect(result.current.item).toMatchObject({
      id: serverItem.id,
      name: 'Resolved Scene',
    })
    expect(result.current.item?.id).not.toBe(optimisticItem.id)
    expect(result.current.contentItem).toBe(result.current.item)
  })

  it('reports not found for an empty active cache and successful empty query', () => {
    routeSearch = { item: testResourceId('empty') }
    activeItems = []
    queryData = { status: 'not_found' }

    const { result } = renderHook(() => useLiveCurrentItem({ getKnownItemById: getActiveItemById }))

    expect(result.current.isNotFound).toBe(true)
  })

  it('treats a successful stale query item as missing for the requested resource', () => {
    const staleItem = createNote({
      id: testResourceId('note-stale'),
      name: 'Stale Scene',
    })
    routeSearch = { item: testResourceId('requested-scene') }
    queryData = { status: 'available', item: staleItem as WizardEditorItemWithContent }

    const { result } = renderHook(() => useLiveCurrentItem({ getKnownItemById: getActiveItemById }))

    expect(result.current.item).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isNotFound).toBe(true)
  })

  it('reports current item query errors', () => {
    queryError = new Error('fetch failed')
    queryStatus = 'error'
    routeSearch = { item: testResourceId('broken') }

    const { result } = renderHook(() => useLiveCurrentItem({ getKnownItemById: getActiveItemById }))

    expect(result.current.itemError).toBe(queryError)
  })

  it('keeps requested resources loading while the item query is pending', () => {
    queryStatus = 'pending'
    isFetching = true
    routeSearch = { item: testResourceId('loading') }

    const { result } = renderHook(() => useLiveCurrentItem({ getKnownItemById: getActiveItemById }))

    expect(result.current).toMatchObject({
      item: null,
      contentItem: null,
      isLoading: true,
      isNotFound: false,
      itemError: null,
    })
  })
})

function getActiveItemById(resourceId: ResourceId) {
  return activeItems.find((item) => item.id === resourceId) ?? null
}

type SidebarItemAccessResult =
  | { status: 'not_found' }
  | { status: 'not_shared' }
  | { status: 'trashed' }
  | { status: 'available'; item: WizardEditorItemWithContent }
