import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { SidebarItemsProvider } from '../../contexts/all-sidebar-items-provider'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { useFilteredSidebarItems } from '../useFilteredSidebarItems'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'

const activeItems = vi.hoisted(() => ({
  data: [] as Array<AnySidebarItem>,
}))
const campaignState = vi.hoisted(() => ({
  isDm: false,
}))
const effectiveHasAtLeastPermissionMock = vi.hoisted(() => vi.fn())
const useAuthQueryMock = vi.hoisted(() => vi.fn())
const setCurrentEditorMock = vi.hoisted(() => vi.fn())

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: (_query: unknown, args: { campaignId: string }) => ({
    queryKey: ['getCurrentEditor', args.campaignId],
  }),
}))

vi.mock('convex/_generated/api', () => ({
  api: {
    editors: {
      queries: { getCurrentEditor: 'getCurrentEditor' },
      mutations: { setCurrentEditor: 'setCurrentEditor' },
    },
    sidebarItems: {
      queries: {
        getActiveSidebarItems: 'getActiveSidebarItems',
        getTrashedSidebarItems: 'getTrashedSidebarItems',
      },
    },
  },
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ campaignId: 'campaign_1', isDm: campaignState.isDm }),
}))

vi.mock('~/features/campaigns/hooks/useCampaignActor', () => ({
  useCampaignActor: () =>
    campaignState.isDm
      ? { kind: 'dm', campaignId: 'campaign_1' }
      : { kind: 'player', campaignId: 'campaign_1' },
}))

vi.mock('~/features/sharing/utils/permission-utils', () => ({
  effectiveHasAtLeastPermission: (...args: Array<unknown>) =>
    effectiveHasAtLeastPermissionMock(...args),
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: (...args: Array<unknown>) => useAuthQueryMock(...args),
}))

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: () => ({ data: null, status: 'success' }),
}))

vi.mock('~/shared/hooks/useCampaignMutation', () => ({
  useCampaignMutation: () => ({ mutate: setCurrentEditorMock }),
}))

let queryClient: QueryClient

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

function wrapper({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(SidebarItemsProvider, null, children),
  )
}

describe('useFilteredSidebarItems', () => {
  beforeEach(() => {
    queryClient = createQueryClient()
    activeItems.data = [
      createNote({ name: 'First', slug: 'first' }),
      createNote({ name: 'Second', slug: 'second' }),
    ]
    campaignState.isDm = false
    effectiveHasAtLeastPermissionMock.mockReset()
    effectiveHasAtLeastPermissionMock.mockReturnValue(true)
    useAuthQueryMock.mockReset()
    useAuthQueryMock.mockImplementation((query) => ({
      data: query === 'getActiveSidebarItems' ? activeItems.data : [],
      status: 'success',
    }))
    setCurrentEditorMock.mockReset()
  })

  it('shares one filtered active sidebar view across consumers', () => {
    const { result } = renderHook(
      () => [useFilteredSidebarItems(), useFilteredSidebarItems()] as const,
      { wrapper },
    )

    expect(result.current[0].data).toEqual(activeItems.data)
    expect(result.current[1].data).toEqual(activeItems.data)
    expect(effectiveHasAtLeastPermissionMock).toHaveBeenCalledTimes(activeItems.data.length)
  })

  it('uses the active sidebar value directly for DM view', () => {
    campaignState.isDm = true

    const { result } = renderHook(() => useFilteredSidebarItems(), { wrapper })

    expect(result.current.data).toBe(activeItems.data)
    expect(effectiveHasAtLeastPermissionMock).not.toHaveBeenCalled()
  })
})
