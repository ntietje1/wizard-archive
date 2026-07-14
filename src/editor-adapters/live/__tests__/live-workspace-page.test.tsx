import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import type { WizardEditorRuntime } from '@wizard-archive/editor/resources/editor-runtime-contract'
import { LiveWorkspacePage } from '../live-workspace-page'

const openCampaignsDashboardMock = vi.hoisted(() => vi.fn())
const editorProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }))
const runtime = vi.hoisted(() => ({ scope: { campaignId: 'campaign' } }) as WizardEditorRuntime)

vi.mock('~/features/campaigns/hooks/useCampaign', () => ({
  useCampaign: () => ({ campaign: { data: { name: 'Storm King' } } }),
}))

vi.mock('../live-workspace-runtime-provider', () => ({
  LiveWorkspaceRuntimeProvider: ({
    children,
  }: {
    children: (value: WizardEditorRuntime) => React.ReactNode
  }) => <>{children(runtime)}</>,
}))

vi.mock('@wizard-archive/editor', () => ({
  WizardEditor: (props: Record<string, unknown>) => {
    editorProps.current = props
    const slots = props.sidebarSlots as {
      bottomPanel: React.ReactNode
      railEndControls: React.ReactNode
      railStartControls: React.ReactNode
    }
    return (
      <section aria-label={props.ariaLabel as string}>
        {slots.railStartControls}
        {slots.railEndControls}
        {slots.bottomPanel}
      </section>
    )
  },
}))

vi.mock('~/editor-adapters/live/use-live-workspace-navigation', () => ({
  useLiveWorkspaceNavigation: () => ({ openCampaignsDashboard: openCampaignsDashboardMock }),
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
  CampaignPanel: ({ onSwitchCampaign }: { onSwitchCampaign: () => void }) => (
    <button onClick={onSwitchCampaign}>Campaign panel</button>
  ),
}))

describe('LiveWorkspacePage', () => {
  beforeEach(() => {
    editorProps.current = null
    openCampaignsDashboardMock.mockReset()
  })

  it('passes the canonical runtime and campaign-owned shell slots to the editor', () => {
    render(<LiveWorkspacePage />)

    expect(editorProps.current).toEqual(
      expect.objectContaining({
        ariaLabel: 'Editor workspace',
        runtime,
        workspaceName: 'Storm King',
      }),
    )
    expect(screen.getByText('Players')).toBeInTheDocument()
    expect(screen.getByText('User menu')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Campaign panel'))
    expect(openCampaignsDashboardMock).toHaveBeenCalledOnce()
  })
})
