import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { WizardEditorRuntime } from '@wizard-archive/editor/resources/editor-runtime-contract'
import { testCampaignId } from '../../../../shared/test/campaign-id'
import { testCampaignMemberId } from '../../../../shared/test/campaign-member-id'
import { LiveWorkspaceRuntimeProvider } from '../live-workspace-runtime-provider'

const campaignId = testCampaignId('live-provider')
const actorId = testCampaignMemberId('live-provider')
const campaignState = vi.hoisted(() => ({
  campaignId: undefined as ReturnType<typeof testCampaignId> | undefined,
  membership: undefined as { id: ReturnType<typeof testCampaignMemberId>; role: 'DM' } | undefined,
}))
const resourceCore = vi.hoisted(
  () =>
    ({
      resources: {
        loader: { ensureResource: vi.fn(), ensureCollection: vi.fn() },
      },
    }) as unknown as WizardEditorRuntime,
)
const useLiveResourceCoreMock = vi.hoisted(() =>
  vi.fn((_scope: unknown, _navigation: unknown) => resourceCore),
)

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    campaignId: campaignState.campaignId,
    campaign: { data: { myMembership: campaignState.membership } },
  }),
}))

vi.mock('../resources/use-live-resource-core', () => ({
  useLiveResourceCore: (scope: unknown, navigation: unknown) =>
    useLiveResourceCoreMock(scope, navigation),
}))

vi.mock('../live-workspace-route-effects', () => ({
  LiveWorkspaceRouteEffects: () => <div data-testid="route-effects" />,
}))

vi.mock('../resources/use-live-resource-navigation', () => ({
  useLiveResourceNavigation: () => ({
    current: () => null,
    open: vi.fn(),
    subscribe: () => () => undefined,
  }),
}))

describe('LiveWorkspaceRuntimeProvider', () => {
  beforeEach(() => {
    campaignState.campaignId = campaignId
    campaignState.membership = { id: actorId, role: 'DM' }
    useLiveResourceCoreMock.mockClear()
  })

  it('provides the one scoped canonical resource runtime', () => {
    render(
      <LiveWorkspaceRuntimeProvider>
        {(runtime) => <div data-testid="runtime-probe">{String(runtime === resourceCore)}</div>}
      </LiveWorkspaceRuntimeProvider>,
    )

    expect(screen.getByTestId('runtime-probe')).toHaveTextContent('true')
    expect(useLiveResourceCoreMock).toHaveBeenCalledExactlyOnceWith(
      {
        campaignId,
        actorId,
        projection: 'dm',
        schema: 'resource-index-v1',
      },
      expect.objectContaining({
        current: expect.any(Function),
        open: expect.any(Function),
        subscribe: expect.any(Function),
      }),
    )
    expect(screen.getByTestId('route-effects')).toBeInTheDocument()
  })

  it('renders loading feedback until actor scope is available', () => {
    campaignState.membership = undefined

    render(
      <LiveWorkspaceRuntimeProvider>
        {() => <div data-testid="runtime-probe" />}
      </LiveWorkspaceRuntimeProvider>,
    )

    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    expect(screen.queryByTestId('runtime-probe')).not.toBeInTheDocument()
    expect(useLiveResourceCoreMock).not.toHaveBeenCalled()
  })
})
