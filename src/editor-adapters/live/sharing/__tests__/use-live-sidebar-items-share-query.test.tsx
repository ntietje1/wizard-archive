import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Id } from 'convex/_generated/dataModel'
import { useLiveSidebarItemsShareQuery } from '../use-live-sidebar-items-share-query'

const useQueriesMock = vi.hoisted(() => vi.fn())
const convexQueryMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-query', () => ({
  useQueries: (input: unknown) => useQueriesMock(input),
}))

vi.mock('@convex-dev/react-query', () => ({
  convexQuery: (...args: Array<unknown>) => convexQueryMock(...args),
}))

vi.mock('convex/react', () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ campaignId: 'campaign_1' }),
}))

describe('useLiveSidebarItemsShareQuery', () => {
  beforeEach(() => {
    convexQueryMock.mockReset()
    convexQueryMock.mockImplementation((_query, args) => ({ args }))
    useQueriesMock.mockReset()
    useQueriesMock.mockImplementation(({ queries }: { queries: Array<unknown> }) =>
      queries.map(() => ({ data: [], error: null, isPending: false, isSuccess: true })),
    )
  })

  it('batches 101 item ids across the production query hook', () => {
    const sidebarItemIds = Array.from(
      { length: 101 },
      (_, index) => `item_${index + 1}` as Id<'sidebarItems'>,
    )

    const { result } = renderHook(() => useLiveSidebarItemsShareQuery(sidebarItemIds))

    expect(convexQueryMock).toHaveBeenCalledTimes(2)
    expect(convexQueryMock.mock.calls.map((call) => call[1])).toEqual([
      {
        campaignId: 'campaign_1',
        sidebarItemIds: sidebarItemIds.slice(0, 100),
      },
      {
        campaignId: 'campaign_1',
        sidebarItemIds: sidebarItemIds.slice(100),
      },
    ])
    expect(result.current).toMatchObject({ data: [], isPending: false, isSuccess: true })
  })
})
