import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { WizardEditorRuntime } from '@wizard-archive/editor/adapter'
import { testCampaignId } from '../../../../shared/test/campaign-id'
import { testCampaignMemberId } from '../../../../shared/test/campaign-member-id'
import { testResourceId } from '../../../../shared/test/resource-id'
import { LiveWorkspaceRuntimeProvider } from '../live-workspace-runtime-provider'

const clearWorkspaceContentMock = vi.hoisted(() => vi.fn())
const navigateToItemMock = vi.hoisted(() => vi.fn())
const useLiveFileSystemRuntimeMock = vi.hoisted(() => vi.fn())
const useLiveWorkspaceRuntimeMock = vi.hoisted(() => vi.fn())
const selectedResourceId = testResourceId('scene-one')
const campaignId = testCampaignId('live-provider')
const actorId = testCampaignMemberId('live-provider')
const campaignState = vi.hoisted(() => ({
  campaignId: undefined as ReturnType<typeof testCampaignId> | undefined,
  campaignSlug: 'lost city',
  dmUsername: 'gm user',
  membership: undefined as { id: ReturnType<typeof testCampaignMemberId>; role: 'DM' } | undefined,
}))
const resourceCore = vi.hoisted(() => ({
  index: {},
  loader: { ensureResource: vi.fn(), ensureCollection: vi.fn() },
  structure: { execute: vi.fn() },
}))
const useLiveResourceCoreMock = vi.hoisted(() => vi.fn((_scope: unknown) => resourceCore))
const filesystemReadModel = vi.hoisted(() => ({
  activeItems: ['active-item'],
  visibleTrashItems: [],
  readModel: {
    getItemBySlug: vi.fn(() => ({ id: 'scene_item', slug: 'scene-one' })),
  },
}))
const filesystemRuntime = vi.hoisted(() => ({
  filesystem: {
    operations: { createItem: vi.fn() },
    clipboardOperations: { copy: vi.fn() },
    dropOperations: { executeDropCommand: vi.fn() },
    trashOperations: { requestTrashItems: vi.fn() },
    dialog: 'Filesystem operation dialog',
  },
  sharing: {
    sidebarItems: { setResourceAudiencePermission: vi.fn() },
  },
}))
const catalog = vi.hoisted(() => ({ getKnownItemBySlug: vi.fn() }))
const runtime = vi.hoisted(
  () =>
    ({
      resources: {
        catalog,
      },
    }) as unknown as WizardEditorRuntime,
)

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    campaignId: campaignState.campaignId,
    campaignSlug: campaignState.campaignSlug,
    dmUsername: campaignState.dmUsername,
    campaign: { data: { myMembership: campaignState.membership } },
  }),
}))

vi.mock('../resources/use-live-resource-core', () => ({
  useLiveResourceCore: (scope: unknown) => useLiveResourceCoreMock(scope),
}))

vi.mock('../filesystem/read-model', () => ({
  useFileSystemReadModel: () => filesystemReadModel,
}))

vi.mock('../use-live-workspace-navigation', () => ({
  useLiveWorkspaceNavigation: () => ({
    clearWorkspaceContent: clearWorkspaceContentMock,
    navigateToItem: navigateToItemMock,
  }),
  useLiveWorkspaceSelectedResourceId: () => selectedResourceId,
}))

vi.mock('../filesystem/host', () => ({
  useLiveFileSystemRuntime: (workspaceId: unknown, navigation: unknown, readModel: unknown) =>
    useLiveFileSystemRuntimeMock(workspaceId, navigation, readModel),
}))

vi.mock('../use-live-workspace-runtime', () => ({
  useLiveWorkspaceRuntime: (args: unknown) => useLiveWorkspaceRuntimeMock(args),
}))

vi.mock('../live-workspace-route-effects', () => ({
  LiveWorkspaceRouteEffects: () => <div data-testid="route-effects" />,
}))

describe('LiveWorkspaceRuntimeProvider', () => {
  beforeEach(() => {
    campaignState.campaignId = campaignId
    campaignState.membership = { id: actorId, role: 'DM' }
    campaignState.campaignSlug = 'lost city'
    campaignState.dmUsername = 'gm user'
    clearWorkspaceContentMock.mockReset()
    navigateToItemMock.mockReset()
    filesystemReadModel.readModel.getItemBySlug.mockClear()
    useLiveFileSystemRuntimeMock.mockReset()
    useLiveFileSystemRuntimeMock.mockReturnValue(filesystemRuntime)
    useLiveWorkspaceRuntimeMock.mockReset()
    useLiveWorkspaceRuntimeMock.mockReturnValue(runtime)
    useLiveResourceCoreMock.mockClear()
  })

  it('builds one live runtime surface from campaign sidebar state and filesystem operations', () => {
    render(
      <LiveWorkspaceRuntimeProvider>
        {(providedRuntime) => <RuntimeProbe providedRuntime={providedRuntime} />}
      </LiveWorkspaceRuntimeProvider>,
    )

    expect(useLiveFileSystemRuntimeMock).toHaveBeenCalledExactlyOnceWith(
      campaignId,
      {
        getCurrentResourceId: expect.any(Function),
        clearWorkspaceContent: clearWorkspaceContentMock,
        openResource: expect.any(Function),
      },
      filesystemReadModel,
    )
    const navigation = useLiveFileSystemRuntimeMock.mock.calls[0]?.[1] as {
      getCurrentResourceId: () => string | null
      openResource: (resource: { id: string }, options?: { replace?: boolean }) => void
    }
    expect(navigation.getCurrentResourceId()).toBe(selectedResourceId)
    const otherResourceId = testResourceId('scene-two')
    navigation.openResource({ id: otherResourceId }, { replace: true })
    expect(navigateToItemMock).toHaveBeenCalledWith(otherResourceId, { replace: true })
    expect(useLiveWorkspaceRuntimeMock).toHaveBeenCalledExactlyOnceWith({
      workspaceId: campaignId,
      filesystemReadModel,
      filesystemHost: filesystemRuntime.filesystem,
      sidebarItemsShareOperations: filesystemRuntime.sharing.sidebarItems,
      openExternalUrl: expect.any(Function),
      openSeparateItem: expect.any(Function),
    })
    expect(screen.getByTestId('runtime-probe')).toHaveAttribute('data-render-prop', 'true')
    expect(useLiveResourceCoreMock).toHaveBeenCalledExactlyOnceWith({
      campaignId,
      actorId,
      projection: 'dm',
      schema: 'resource-index-v1',
    })
    expect(screen.getByTestId('route-effects')).toBeInTheDocument()
    expect(screen.getByText('Filesystem operation dialog')).toBeInTheDocument()
  })

  it('renders loading feedback until a campaign workspace id is available', () => {
    campaignState.campaignId = undefined
    campaignState.membership = undefined

    render(
      <LiveWorkspaceRuntimeProvider>
        {(providedRuntime) => <RuntimeProbe providedRuntime={providedRuntime} />}
      </LiveWorkspaceRuntimeProvider>,
    )

    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
    expect(screen.queryByTestId('runtime-probe')).not.toBeInTheDocument()
    expect(useLiveFileSystemRuntimeMock).not.toHaveBeenCalled()
    expect(useLiveWorkspaceRuntimeMock).not.toHaveBeenCalled()
  })

  it('keeps browser tab opening at the live provider edge', () => {
    const openMock = vi.spyOn(window, 'open').mockImplementation(() => null)
    render(
      <LiveWorkspaceRuntimeProvider>
        {(providedRuntime) => <RuntimeProbe providedRuntime={providedRuntime} />}
      </LiveWorkspaceRuntimeProvider>,
    )

    const runtimeInput = useLiveWorkspaceRuntimeMock.mock.calls[0]?.[0] as {
      openExternalUrl: (url: string) => void
      openSeparateItem: (input: { heading?: string; resourceId: string }) => void
    }
    runtimeInput.openExternalUrl('https://example.com/file.pdf')
    runtimeInput.openSeparateItem({
      heading: 'Intro#Details',
      resourceId: selectedResourceId,
    })

    const expectedSearchParams = new URLSearchParams({ item: selectedResourceId })
    expectedSearchParams.set('heading', 'Intro#Details')
    expect(openMock).toHaveBeenCalledWith(
      'https://example.com/file.pdf',
      '_blank',
      'noopener,noreferrer',
    )
    expect(openMock).toHaveBeenCalledWith(
      `/campaigns/gm%20user/lost%20city/editor?${expectedSearchParams.toString()}`,
      '_blank',
      'noopener,noreferrer',
    )
    openMock.mockRestore()
  })
})

function RuntimeProbe({ providedRuntime }: { providedRuntime: WizardEditorRuntime }) {
  return <div data-testid="runtime-probe" data-render-prop={String(providedRuntime === runtime)} />
}
