import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Id } from 'convex/_generated/dataModel'
import { useLiveSidebarItemsQueries } from '../use-live-sidebar-items-queries'

const authQueryCalls = vi.hoisted(() => [] as Array<Array<unknown>>)
let campaignId: Id<'campaigns'> | null = 'campaign-1' as Id<'campaigns'>

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ campaignId }),
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: (...args: Array<unknown>) => {
    authQueryCalls.push(args)
    return {
      data: null,
      error: null,
      refetch: vi.fn(),
      status: 'success',
    }
  },
}))

describe('useLiveSidebarItemsQueries', () => {
  beforeEach(() => {
    authQueryCalls.length = 0
    campaignId = 'campaign-1' as Id<'campaigns'>
  })

  it('loads active and trash sidebar items through one campaign query', () => {
    renderHook(() => useLiveSidebarItemsQueries())

    expect(authQueryCalls).toHaveLength(1)
    expect(authQueryCalls[0]?.[1]).toEqual({ campaignId: 'campaign-1' })
    expect(authQueryCalls[0]).toHaveLength(2)
  })

  it('skips sidebar queries without a campaign', () => {
    campaignId = null

    renderHook(() => useLiveSidebarItemsQueries())

    expect(authQueryCalls.map((call) => call[1])).toEqual(['skip'])
  })
})
