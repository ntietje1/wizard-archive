import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { testCampaignId } from '../../../../shared/test/campaign-id'
import { testResourceId } from '../../../../shared/test/resource-id'
import { EDITOR_ROUTE_ID } from '../editor-route'
import { LiveWorkspaceRouteEffects } from '../live-workspace-route-effects'

const useMatchMock = vi.hoisted(() => vi.fn())
const useCampaignMock = vi.hoisted(() => vi.fn())
const addRecentItemMock = vi.hoisted(() => vi.fn())
const ensureResourceMock = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ status: 'completed' as const })),
)
const resourceLoader = { ensureResource: ensureResourceMock, ensureCollection: vi.fn() }

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
  const campaignId = testCampaignId('route-effects')
  const resourceId = testResourceId('scene-one')
  beforeEach(() => {
    useMatchMock.mockReset()
    useCampaignMock.mockReset()
    addRecentItemMock.mockReset()
    ensureResourceMock.mockClear()
    useCampaignMock.mockReturnValue({ campaignId })
    useMatchMock.mockReturnValue({ search: { item: resourceId } })
  })

  it('records the current live route resource as a recent item', () => {
    render(<LiveWorkspaceRouteEffects resourceLoader={resourceLoader} />)

    expect(useMatchMock).toHaveBeenCalledWith({
      from: EDITOR_ROUTE_ID,
      shouldThrow: false,
    })
    expect(addRecentItemMock).toHaveBeenCalledExactlyOnceWith(campaignId, resourceId)
    expect(ensureResourceMock).toHaveBeenCalledExactlyOnceWith(resourceId)
  })

  it('does not record a recent item without a route resource', () => {
    useMatchMock.mockReturnValue({ search: {} })

    render(<LiveWorkspaceRouteEffects resourceLoader={resourceLoader} />)

    expect(addRecentItemMock).not.toHaveBeenCalled()
    expect(ensureResourceMock).not.toHaveBeenCalled()
  })

  it('does not record a recent item without a workspace context', () => {
    useCampaignMock.mockReturnValue({ campaignId: undefined })

    render(<LiveWorkspaceRouteEffects resourceLoader={resourceLoader} />)

    expect(addRecentItemMock).not.toHaveBeenCalled()
    expect(ensureResourceMock).not.toHaveBeenCalled()
  })
})
