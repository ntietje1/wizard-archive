import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { EditorRuntime } from '@wizard-archive/editor/resources/editor-runtime-contract'
import { testDomainId } from '../../../../shared/test/domain-id'
import { LiveWorkspaceRuntimeProvider } from '../live-workspace-runtime-provider'

const campaignId = testDomainId('campaign', 'live-provider')
const otherCampaignId = testDomainId('campaign', 'other-live-provider')
const actorId = testDomainId('campaignMember', 'live-provider')
const playerId = testDomainId('campaignMember', 'live-provider-player')
const campaignState = vi.hoisted(() => ({
  campaignId: undefined as typeof campaignId | undefined,
  membership: undefined as
    | {
        id: typeof actorId
        role: 'DM' | 'Player'
        userProfile: { name: string | null; username: string }
      }
    | undefined,
  membersPending: false,
  members: [] as Array<{
    id: typeof playerId
    role: 'Player'
    userProfile: { imageUrl: null; name: string | null; username: string }
  }>,
}))
const resourceCore = vi.hoisted(
  () =>
    ({
      resources: {
        loader: { ensureResource: vi.fn(), ensureCollection: vi.fn() },
      },
    }) as unknown as EditorRuntime,
)
const useLiveResourceCoreMock = vi.hoisted(() =>
  vi.fn((scope: unknown, _navigation: unknown, _collaborationUser: unknown) => ({
    ...resourceCore,
    scope,
  })),
)
const useCampaignMembersQueryMock = vi.hoisted(() =>
  vi.fn((_campaignId: unknown) => ({
    data: campaignState.members,
    isPending: campaignState.membersPending,
  })),
)

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    campaignId: campaignState.campaignId,
    campaign: { data: { myMembership: campaignState.membership } },
  }),
}))

vi.mock('../resources/use-live-resource-core', () => ({
  useLiveResourceCore: (scope: unknown, navigation: unknown, collaborationUser: unknown) =>
    useLiveResourceCoreMock(scope, navigation, collaborationUser),
}))

vi.mock('~/features/campaigns/hooks/use-campaign-operations', () => ({
  useCampaignMembersQuery: (workspaceId: unknown) => useCampaignMembersQueryMock(workspaceId),
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
    campaignState.membership = {
      id: actorId,
      role: 'DM',
      userProfile: { name: 'Editor', username: 'editor' },
    }
    campaignState.members = [
      {
        id: playerId,
        role: 'Player',
        userProfile: { imageUrl: null, name: 'Player', username: 'player' },
      },
    ]
    campaignState.membersPending = false
    useLiveResourceCoreMock.mockClear()
    useCampaignMembersQueryMock.mockClear()
  })

  it('provides the one scoped canonical resource runtime', () => {
    let runtime: EditorRuntime | null = null
    render(
      <LiveWorkspaceRuntimeProvider>
        {(value) => {
          runtime = value
          return <div data-testid="runtime-probe" />
        }}
      </LiveWorkspaceRuntimeProvider>,
    )

    expect(runtime).not.toBeNull()
    expect(runtime!.resources).toBe(resourceCore.resources)
    expect(runtime!.viewAs).toEqual({
      status: 'available',
      value: {
        pending: false,
        participants: [
          {
            id: playerId,
            displayName: 'Player',
            username: 'player',
            imageUrl: null,
          },
        ],
        selectedParticipantId: null,
        select: expect.any(Function),
      },
    })
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
      { name: 'Editor', color: expect.stringMatching(/^#[0-9a-f]{6}$/) },
    )
    expect(useCampaignMembersQueryMock).toHaveBeenCalledWith(campaignId)
    expect(screen.getByTestId('route-effects')).toBeInTheDocument()
  })

  it('remounts the resource runtime in the selected readonly player projection', () => {
    let runtime: EditorRuntime | null = null
    render(
      <LiveWorkspaceRuntimeProvider>
        {(value) => {
          runtime = value
          return <div data-testid="runtime-probe" />
        }}
      </LiveWorkspaceRuntimeProvider>,
    )
    const viewAs = runtime!.viewAs as Extract<EditorRuntime['viewAs'], { status: 'available' }>

    act(() => viewAs.value.select(playerId))

    expect(runtime!.scope).toMatchObject({
      actorId: playerId,
      projection: 'view_as_player',
    })
    expect(runtime!.viewAs).toMatchObject({
      status: 'available',
      value: { selectedParticipantId: playerId },
    })
    expect(useLiveResourceCoreMock).toHaveBeenLastCalledWith(
      {
        campaignId,
        actorId: playerId,
        projection: 'view_as_player',
        schema: 'resource-index-v1',
      },
      expect.any(Object),
      { name: 'Editor', color: expect.stringMatching(/^#[0-9a-f]{6}$/) },
    )
  })

  it('does not carry a player projection into another campaign', () => {
    let runtime: EditorRuntime | null = null
    const rendered = render(
      <LiveWorkspaceRuntimeProvider>
        {(value) => {
          runtime = value
          return <div data-testid="runtime-probe" />
        }}
      </LiveWorkspaceRuntimeProvider>,
    )
    const viewAs = runtime!.viewAs as Extract<EditorRuntime['viewAs'], { status: 'available' }>
    act(() => viewAs.value.select(playerId))
    expect(runtime!.scope.projection).toBe('view_as_player')

    campaignState.campaignId = otherCampaignId
    rendered.rerender(
      <LiveWorkspaceRuntimeProvider>
        {(value) => {
          runtime = value
          return <div data-testid="runtime-probe" />
        }}
      </LiveWorkspaceRuntimeProvider>,
    )

    expect(runtime!.scope).toMatchObject({
      campaignId: otherCampaignId,
      actorId,
      projection: 'dm',
    })
    expect(runtime!.viewAs).toMatchObject({
      status: 'available',
      value: { selectedParticipantId: null },
    })
  })

  it('updates player-menu state without rebuilding the resource core', () => {
    campaignState.membersPending = true
    let runtime: EditorRuntime | null = null
    const rendered = render(
      <LiveWorkspaceRuntimeProvider>
        {(value) => {
          runtime = value
          return <div data-testid="runtime-probe" />
        }}
      </LiveWorkspaceRuntimeProvider>,
    )

    expect(runtime!.viewAs).toMatchObject({
      status: 'available',
      value: { pending: true },
    })
    const initialResources = runtime!.resources

    campaignState.membersPending = false
    rendered.rerender(
      <LiveWorkspaceRuntimeProvider>
        {(value) => {
          runtime = value
          return <div data-testid="runtime-probe" />
        }}
      </LiveWorkspaceRuntimeProvider>,
    )

    expect(runtime!.viewAs).toMatchObject({
      status: 'available',
      value: { pending: false },
    })
    expect(runtime!.resources).toBe(initialResources)
  })

  it('does not load or expose DM controls to a player', () => {
    campaignState.membership = {
      id: actorId,
      role: 'Player',
      userProfile: { name: 'Player', username: 'player' },
    }
    let runtime: EditorRuntime | null = null

    render(
      <LiveWorkspaceRuntimeProvider>
        {(value) => {
          runtime = value
          return <div data-testid="runtime-probe" />
        }}
      </LiveWorkspaceRuntimeProvider>,
    )

    expect(useCampaignMembersQueryMock).toHaveBeenCalledWith(undefined)
    expect(runtime!.scope.projection).toBe('player')
    expect(runtime!.viewAs).toEqual({ status: 'unavailable', reason: 'unauthorized' })
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
