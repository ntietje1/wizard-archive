import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type * as TanStackRouter from '@tanstack/react-router'
import { PublicDemoHeroIsland } from '~/features/landing/components/public-demo-islands'
import { LiveWorkspacePage } from '~/editor-adapters/live/live-workspace-page'
import { LocalDemoRouteContent } from '~/routes/-demo-content'

const graphState = vi.hoisted(() => ({
  hostProps: [] as Array<Record<string, unknown>>,
  liveRuntime: {
    source: 'live-runtime',
    workspace: { id: 'live-workspace', instanceId: 'live-runtime' },
  },
  localRuntime: {
    source: 'local-runtime',
    workspace: { id: 'local-workspace', instanceId: 'local-runtime' },
  },
  localRuntimeInputs: [] as Array<Record<string, unknown>>,
  navigate: vi.fn(),
  openCampaignsDashboard: vi.fn(),
  savePanelPreference: vi.fn(),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof TanStackRouter>()
  return {
    ...actual,
    ClientOnly: ({ children }: { children: ReactNode }) => children,
    Link: ({
      children,
      className,
      to,
    }: {
      children: ReactNode
      className?: string
      to: string
    }) => (
      <a className={className} href={to}>
        {children}
      </a>
    ),
    useMatch: () => ({ search: {} }),
    useNavigate: () => graphState.navigate,
    useRouteContext: () => ({ initialPanelPreferences: null }),
  }
})

vi.mock('@wizard-archive/editor/resources/resource-shell', () => ({
  ResourceShell: (props: Record<string, unknown>) => {
    graphState.hostProps.push(props)
    return <section aria-label={props.ariaLabel as string}>Workspace runtime host</section>
  },
}))

vi.mock('~/editor-adapters/local/use-local-workspace-runtime', () => ({
  useLocalWorkspaceRuntime: (props: Record<string, unknown>) => {
    graphState.localRuntimeInputs.push(props)
    return graphState.localRuntime
  },
}))

vi.mock('~/editor-adapters/live/live-workspace-runtime-provider', () => ({
  LiveWorkspaceRuntimeProvider: ({ children }: { children: (runtime: unknown) => ReactNode }) => (
    <>{children(graphState.liveRuntime)}</>
  ),
}))

vi.mock('~/editor-adapters/live/use-live-workspace-navigation', () => ({
  useLiveWorkspaceNavigation: () => ({
    openCampaignsDashboard: graphState.openCampaignsDashboard,
  }),
}))

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({
    campaign: { data: { name: 'Storm King' } },
    campaignId: '018f2e40-7c00-7000-8000-000000000005',
  }),
}))

vi.mock('~/features/campaigns/runtime/use-live-campaign-panel-source', () => ({
  useLiveCampaignPanelSource: () => ({ source: 'campaign-panel' }),
}))

vi.mock('~/features/campaigns/components/campaign-players-button', () => ({
  CampaignPlayersButton: () => <button>Players</button>,
}))

vi.mock('~/features/auth/components/user-menu', () => ({
  UserMenu: () => <button>User menu</button>,
}))

vi.mock('~/features/campaigns/components/campaign-panel/campaign-panel', () => ({
  CampaignPanel: () => <button>Campaign panel</button>,
}))

vi.mock('~/shared/hooks/useAuthQuery', () => ({
  useAuthQuery: () => ({ data: null, isSuccess: true }),
}))

vi.mock('~/shared/hooks/useAppMutation', () => ({
  useAppMutation: () => ({ mutate: graphState.savePanelPreference }),
}))

vi.mock('~/shared/utils/logger', () => ({
  handleError: vi.fn(),
}))

describe('editor graph parity', () => {
  beforeEach(() => {
    graphState.hostProps.length = 0
    graphState.localRuntimeInputs.length = 0
    graphState.navigate.mockReset()
    graphState.openCampaignsDashboard.mockReset()
    graphState.savePanelPreference.mockReset()
    window.history.replaceState(null, '', '/')
  })

  it('mounts the full demo and landing island through the local adapter and package editor host', () => {
    render(
      <>
        <LocalDemoRouteContent />
        <PublicDemoHeroIsland />
      </>,
    )

    expect(graphState.localRuntimeInputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          initialResourceId: null,
        }),
        expect.objectContaining({
          canEdit: false,
        }),
      ]),
    )
    expect(graphState.hostProps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ariaLabel: 'Demo workspace',
          runtime: graphState.localRuntime,
          workspaceName: 'Demo workspace',
        }),
        expect.objectContaining({
          ariaLabel: 'Demo workspace',
          runtime: graphState.localRuntime,
          showResourcePanel: true,
          workspaceName: 'Demo workspace',
        }),
      ]),
    )
  })

  it('mounts the live editor through the live adapter and the same package editor host', () => {
    render(<LiveWorkspacePage />)

    expect(graphState.hostProps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ariaLabel: 'Editor workspace',
          runtime: graphState.liveRuntime,
          workspaceName: 'Storm King',
        }),
      ]),
    )
  })
})
