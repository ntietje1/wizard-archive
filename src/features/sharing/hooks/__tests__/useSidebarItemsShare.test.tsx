import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Id } from 'convex/_generated/dataModel'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { createNote } from '~/test/factories/sidebar-item-factory'
import { useSidebarItemsShare } from '../useSidebarItemsShare'

const useCampaignQueryMock = vi.hoisted(() => vi.fn())
const useCampaignMutationMock = vi.hoisted(() => vi.fn())
const campaignMock = vi.hoisted(() => ({
  isDm: true,
  campaignData: { _id: 'campaign_1' },
}))
const useCampaignMembersMock = vi.hoisted(() => vi.fn())

vi.mock('convex/_generated/api', () => ({
  api: {
    sidebarShares: {
      queries: { getSidebarItemsWithShares: 'getSidebarItemsWithShares' },
      mutations: {
        setSidebarItemsMemberPermission: 'setSidebarItemsMemberPermission',
        clearSidebarItemsMemberPermission: 'clearSidebarItemsMemberPermission',
        setAllPlayersPermissionForSidebarItems: 'setAllPlayersPermissionForSidebarItems',
        setFolderInheritShares: 'setFolderInheritShares',
      },
    },
  },
}))

vi.mock('~/shared/hooks/useCampaignQuery', () => ({
  useCampaignQuery: (...args: Array<unknown>) => useCampaignQueryMock(...args),
}))

vi.mock('~/shared/hooks/useCampaignMutation', () => ({
  useCampaignMutation: (...args: Array<unknown>) => useCampaignMutationMock(...args),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    isDm: campaignMock.isDm,
    campaign: { data: campaignMock.campaignData },
  }),
}))

vi.mock('~/features/players/hooks/useCampaignMembers', () => ({
  useCampaignMembers: () => useCampaignMembersMock(),
}))

describe('useSidebarItemsShare', () => {
  beforeEach(() => {
    useCampaignQueryMock.mockReset()
    useCampaignMutationMock.mockReset()
    useCampaignMembersMock.mockReset()
    campaignMock.isDm = true
    campaignMock.campaignData = { _id: 'campaign_1' }
    useCampaignQueryMock.mockReturnValue({
      data: [],
      isPending: false,
      isSuccess: true,
    })
    useCampaignMembersMock.mockReturnValue({
      data: [],
      isSuccess: true,
    })
    useCampaignMutationMock.mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    })
  })

  it('skips share queries for optimistic sidebar items', () => {
    const item = createNote({ _id: 'optimistic-create-1' as Id<'sidebarItems'> })

    const { result } = renderHook(() => useSidebarItemsShare([item]))

    expect(useCampaignQueryMock).toHaveBeenCalledWith('getSidebarItemsWithShares', 'skip')
    expect(result.current.canShare).toBe(false)
  })

  it('queries share data for persisted sidebar items', () => {
    const item = createNote({ _id: 'note_1' as Id<'sidebarItems'> })

    const { result } = renderHook(() => useSidebarItemsShare([item]))

    expect(useCampaignQueryMock).toHaveBeenCalledWith('getSidebarItemsWithShares', {
      sidebarItemIds: ['note_1'],
    })
    expect(result.current.canShare).toBe(true)
    expect(result.current.isPending).toBe(false)
    expect(result.current.query.data).toEqual([])
  })

  it('does not allow share mutations for non-DMs', async () => {
    campaignMock.isDm = false
    const mutateAsync = vi.fn()
    useCampaignMutationMock.mockReturnValue({
      isPending: false,
      mutateAsync,
    })
    const item = createNote({ _id: 'note_1' as Id<'sidebarItems'> })

    const { result } = renderHook(() => useSidebarItemsShare([item]))

    await result.current.setAllPlayersPermission(PERMISSION_LEVEL.VIEW)

    expect(mutateAsync).not.toHaveBeenCalled()
  })
})
