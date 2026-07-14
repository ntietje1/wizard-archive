import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { Id } from 'convex/_generated/dataModel'
import { testResourceId } from '../../../../shared/test/resource-id'
import { EDITOR_ROUTE_ID } from '../editor-route'
import { LiveWorkspaceRouteEffects } from '../live-workspace-route-effects'

const useMatchMock = vi.hoisted(() => vi.fn())
const useCampaignMock = vi.hoisted(() => vi.fn())
const addRecentItemMock = vi.hoisted(() => vi.fn())

vi.mock('@tanstack/react-router', () => ({
  useMatch: (input: unknown) => useMatchMock(input),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => useCampaignMock(),
}))

vi.mock('~/editor-adapters/live/live-recent-items', () => ({
  addLiveRecentItem: (workspaceRecordId: unknown, resourceId: unknown) =>
    addRecentItemMock(workspaceRecordId, resourceId),
}))

describe('LiveWorkspaceRouteEffects', () => {
  const resourceId = testResourceId('scene-one')
  beforeEach(() => {
    useMatchMock.mockReset()
    useCampaignMock.mockReset()
    addRecentItemMock.mockReset()
    useCampaignMock.mockReturnValue({ campaignId: 'campaign_1' as Id<'campaigns'> })
    useMatchMock.mockReturnValue({ search: { item: resourceId } })
  })

  it('records the current live route resource as a recent item', () => {
    render(<LiveWorkspaceRouteEffects />)

    expect(useMatchMock).toHaveBeenCalledWith({
      from: EDITOR_ROUTE_ID,
      shouldThrow: false,
    })
    expect(addRecentItemMock).toHaveBeenCalledExactlyOnceWith('campaign_1', resourceId)
  })

  it('does not record a recent item without a route resource', () => {
    useMatchMock.mockReturnValue({ search: {} })

    render(<LiveWorkspaceRouteEffects />)

    expect(addRecentItemMock).not.toHaveBeenCalled()
  })

  it('does not record a recent item without a workspace context', () => {
    useCampaignMock.mockReturnValue({ campaignId: undefined })

    render(<LiveWorkspaceRouteEffects />)

    expect(addRecentItemMock).not.toHaveBeenCalled()
  })
})
