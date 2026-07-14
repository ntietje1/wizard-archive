import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { EDITOR_ROUTE, EDITOR_ROUTE_ID } from '../editor-route'
import { LiveWorkspacePage } from '../live-workspace-page'
import type { WorkspaceRuntime } from '@wizard-archive/editor/runtime'

const navigateMock = vi.hoisted(() => vi.fn())
const campaignId = vi.hoisted(() => '018f2e40-7c00-7000-8000-000000000002')
const useMatchMock = vi.hoisted(() => vi.fn())
const openCampaignsDashboardMock = vi.hoisted(() => vi.fn())
const savePanelPreferenceMock = vi.hoisted(() => vi.fn())
const createViewStateStoresMock = vi.hoisted(() => vi.fn(() => ({})))
const noteHeadingRequestProps = vi.hoisted(
  () =>
    ({
      current: null as {
        heading: string | null | undefined
        onConsumed?: () => void
      } | null,
    }) satisfies {
      current: {
        heading: string | null | undefined
        onConsumed?: () => void
      } | null
    },
)
const panelPreferencesProps = vi.hoisted(
  () =>
    ({
      current: null as {
        appliedPanelPreferences: Record<
          string,
          { size: number | null; visible: boolean | null }
        > | null
        initialPanelPreferences: Record<
          string,
          { size: number | null; visible: boolean | null }
        > | null
        isLoaded: boolean
        onPanelPreferenceChange?: (preference: {
          panelId: string
          size: number
          visible: boolean
        }) => void
      } | null,
    }) satisfies {
      current: {
        appliedPanelPreferences: Record<
          string,
          { size: number | null; visible: boolean | null }
        > | null
        initialPanelPreferences: Record<
          string,
          { size: number | null; visible: boolean | null }
        > | null
        isLoaded: boolean
        onPanelPreferenceChange?: (preference: {
          panelId: string
          size: number
          visible: boolean
        }) => void
      } | null
    },
)
const routeState = vi.hoisted(() => ({
  search: {} as { heading?: string; item?: string; trash?: boolean },
}))
const routeContextState = vi.hoisted(() => ({
  initialPanelPreferences: null as Record<
    string,
    { size: number | null; visible: boolean | null }
  > | null,
}))
const preferencesQueryState = vi.hoisted(() => ({
  data: null as {
    panelPreferences: Record<string, { size: number | null; visible: boolean | null }> | null
  } | null,
  isError: false,
  isPending: true,
  isSuccess: false,
}))

const runtime = vi.hoisted(() => ({
  workspace: { id: 'campaign-1', instanceId: 'campaign-runtime-1' },
  resources: { current: { contentItem: null } },
}))
const sidebarSort = vi.hoisted(() => ({ options: { order: 'manual' }, setOptions: vi.fn() }))

vi.mock('@tanstack/react-router', () => ({
  useMatch: (input: unknown) => useMatchMock(input),
  useNavigate: () => navigateMock,
  useRouteContext: () => routeContextState,
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: () => preferencesQueryState,
}))

vi.mock('~/shared/hooks/useAppMutation', () => ({
  useAppMutation: () => ({ mutateAsync: savePanelPreferenceMock }),
}))

vi.mock('~/shared/utils/logger', () => ({
  handleError: vi.fn(),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    campaign: { data: { name: 'Storm King' } },
    campaignId,
  }),
}))

vi.mock('../live-workspace-runtime-provider', () => ({
  LiveWorkspaceRuntimeProvider: ({
    children,
  }: {
    children: (runtime: WorkspaceRuntime) => React.ReactNode
  }) => <>{children(runtime as unknown as WorkspaceRuntime)}</>,
}))

vi.mock('../sidebar/use-live-sidebar-sort-options', () => ({
  useLiveSidebarSortOptions: () => sidebarSort,
}))

vi.mock('@wizard-archive/editor', () => ({
  WizardEditor: ({
    sidebar,
    sidebarSort: providedSidebarSort,
    sidebarSlots,
    noteHeadingRequest,
    panelPreferences,
    workspaceName,
  }: {
    noteHeadingRequest: {
      heading: string | null | undefined
      onConsumed?: () => void
    }
    panelPreferences: typeof panelPreferencesProps.current
    sidebar: string
    sidebarSlots: {
      bottomPanel: React.ReactNode
      railEndControls: React.ReactNode
      railStartControls: React.ReactNode
    }
    sidebarSort: unknown
    workspaceName: string | null
  }) => {
    noteHeadingRequestProps.current = noteHeadingRequest
    panelPreferencesProps.current = panelPreferences
    return (
      <div data-sidebar-sort={providedSidebarSort === sidebarSort} data-sidebar-mode={sidebar}>
        <div data-workspace-name={workspaceName}>Workspace runtime host</div>
        {sidebarSlots.railStartControls}
        {sidebarSlots.railEndControls}
        {sidebarSlots.bottomPanel}
      </div>
    )
  },
  createBrowserWizardEditorViewStateStores: createViewStateStoresMock,
}))

vi.mock('~/editor-adapters/live/use-live-workspace-navigation', () => ({
  useLiveWorkspaceNavigation: () => ({
    openCampaignsDashboard: openCampaignsDashboardMock,
  }),
}))

vi.mock('~/features/campaigns/runtime/use-live-campaign-panel-source', () => ({
  useLiveCampaignPanelSource: () => ({ campaign: 'panel-source' }),
}))

vi.mock('~/features/campaigns/components/campaign-players-button', () => ({
  CampaignPlayersButton: () => <button>Players</button>,
}))

vi.mock('~/features/auth/components/user-menu', () => ({
  UserMenu: () => <button>User menu</button>,
}))

vi.mock('~/features/campaigns/components/campaign-panel/campaign-panel', () => ({
  CampaignPanel: ({
    onSwitchCampaign,
    source,
  }: {
    onSwitchCampaign: () => void
    source: unknown
  }) => (
    <button
      data-campaign-panel-source={source === null ? 'missing' : 'present'}
      onClick={onSwitchCampaign}
    >
      Campaign panel
    </button>
  ),
}))

describe('LiveWorkspacePage', () => {
  beforeEach(() => {
    routeState.search = {}
    routeContextState.initialPanelPreferences = null
    preferencesQueryState.data = null
    preferencesQueryState.isError = false
    preferencesQueryState.isPending = true
    preferencesQueryState.isSuccess = false
    noteHeadingRequestProps.current = null
    panelPreferencesProps.current = null
    navigateMock.mockReset()
    useMatchMock.mockReset()
    useMatchMock.mockImplementation(() => ({ search: routeState.search }))
    openCampaignsDashboardMock.mockReset()
    savePanelPreferenceMock.mockReset()
    createViewStateStoresMock.mockClear()
  })

  it('routes live heading search into the editor host and clears it when consumed', () => {
    routeState.search = {
      heading: 'Intro',
      item: 'session-notes',
    }
    routeContextState.initialPanelPreferences = {
      'left-sidebar': { size: 34, visible: true },
    }
    preferencesQueryState.data = {
      panelPreferences: {
        'editor-right-sidebar': { size: 42, visible: false },
      },
    }
    preferencesQueryState.isSuccess = true
    preferencesQueryState.isPending = false

    render(<LiveWorkspacePage />)

    expect(useMatchMock).toHaveBeenCalledWith({
      from: EDITOR_ROUTE_ID,
      shouldThrow: false,
    })
    expect(screen.getByText('Workspace runtime host')).toHaveAttribute(
      'data-workspace-name',
      'Storm King',
    )
    expect(createViewStateStoresMock).toHaveBeenCalledWith({
      namespace: 'campaign-runtime-1',
    })
    expect(screen.getByText('Workspace runtime host').parentElement).toHaveAttribute(
      'data-sidebar-sort',
      'true',
    )
    expect(screen.getByText('Workspace runtime host').parentElement).toHaveAttribute(
      'data-sidebar-mode',
      'resizable',
    )
    expect(screen.getByText('Players')).toBeInTheDocument()
    expect(screen.getByText('User menu')).toBeInTheDocument()
    expect(screen.getByText('Campaign panel')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Campaign panel'))
    expect(openCampaignsDashboardMock).toHaveBeenCalledOnce()
    expect(noteHeadingRequestProps.current).toMatchObject({
      heading: 'Intro',
    })
    expect(panelPreferencesProps.current).toMatchObject({
      appliedPanelPreferences: {
        'editor-right-sidebar': { size: 42, visible: false },
      },
      initialPanelPreferences: {
        'left-sidebar': { size: 34, visible: true },
      },
      isLoaded: true,
    })

    panelPreferencesProps.current?.onPanelPreferenceChange?.({
      panelId: 'left-sidebar',
      size: 30,
      visible: false,
    })

    expect(savePanelPreferenceMock).toHaveBeenCalledWith({
      panelId: 'left-sidebar',
      size: 30,
      visible: false,
    })

    noteHeadingRequestProps.current?.onConsumed?.()

    expect(navigateMock).toHaveBeenCalledWith({
      to: EDITOR_ROUTE,
      params: { campaignId },
      search: { item: 'session-notes' },
      replace: true,
    })
  })

  it('passes unloaded panel preferences and clears absent heading requests safely', () => {
    render(<LiveWorkspacePage />)

    expect(noteHeadingRequestProps.current).toMatchObject({
      heading: undefined,
    })
    expect(panelPreferencesProps.current).toMatchObject({
      appliedPanelPreferences: null,
      initialPanelPreferences: null,
      isLoaded: false,
    })

    noteHeadingRequestProps.current?.onConsumed?.()

    expect(navigateMock).toHaveBeenCalledWith({
      to: EDITOR_ROUTE,
      params: { campaignId },
      search: {},
      replace: true,
    })
  })

  it('loads fallback panel preferences when the live preference query fails', () => {
    routeContextState.initialPanelPreferences = {
      'left-sidebar': { size: 28, visible: true },
    }
    preferencesQueryState.isError = true
    preferencesQueryState.isPending = false

    render(<LiveWorkspacePage />)

    expect(panelPreferencesProps.current).toMatchObject({
      appliedPanelPreferences: null,
      initialPanelPreferences: {
        'left-sidebar': { size: 28, visible: true },
      },
      isLoaded: true,
    })
  })
})
