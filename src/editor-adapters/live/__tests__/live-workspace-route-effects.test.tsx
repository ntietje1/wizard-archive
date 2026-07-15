import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { testDomainId } from '../../../../shared/test/domain-id'
import { EDITOR_ROUTE_ID } from '../editor-route'
import { LiveWorkspaceRouteEffects } from '../live-workspace-route-effects'

const useMatchMock = vi.hoisted(() => vi.fn())
const useCampaignMock = vi.hoisted(() => vi.fn())
const addRecentResourceMock = vi.hoisted(() => vi.fn())
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

vi.mock('~/editor-adapters/live/live-recent-resources', () => ({
  addLiveRecentResource: (campaignId: unknown, resourceId: unknown) =>
    addRecentResourceMock(campaignId, resourceId),
}))

describe('LiveWorkspaceRouteEffects', () => {
  const campaignId = testDomainId('campaign', 'route-effects')
  const resourceId = testDomainId('resource', 'scene-one')
  beforeEach(() => {
    useMatchMock.mockReset()
    useCampaignMock.mockReset()
    addRecentResourceMock.mockReset()
    ensureResourceMock.mockClear()
    useCampaignMock.mockReturnValue({ campaignId })
    useMatchMock.mockReturnValue({ search: { resource: resourceId } })
  })

  it('records the current live route resource as a recent resource', () => {
    render(<LiveWorkspaceRouteEffects resourceLoader={resourceLoader} />)

    expect(useMatchMock).toHaveBeenCalledWith({
      from: EDITOR_ROUTE_ID,
      shouldThrow: false,
    })
    expect(addRecentResourceMock).toHaveBeenCalledExactlyOnceWith(campaignId, resourceId)
    expect(ensureResourceMock).toHaveBeenCalledExactlyOnceWith(resourceId)
  })

  it('does not record a recent resource without a route resource', () => {
    useMatchMock.mockReturnValue({ search: {} })

    render(<LiveWorkspaceRouteEffects resourceLoader={resourceLoader} />)

    expect(addRecentResourceMock).not.toHaveBeenCalled()
    expect(ensureResourceMock).not.toHaveBeenCalled()
  })
})
