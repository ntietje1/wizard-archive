import { ResourceShell } from '@wizard-archive/editor/resources/resource-shell'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { CampaignPanel } from '~/features/campaigns/components/campaign-panel/campaign-panel'
import { CampaignPlayersButton } from '~/features/campaigns/components/campaign-players-button'
import { UserMenu } from '~/features/auth/components/user-menu'
import { useLiveCampaignPanelSource } from '~/features/campaigns/runtime/use-live-campaign-panel-source'
import { useLiveWorkspaceNavigation } from '~/editor-adapters/live/use-live-workspace-navigation'
import { LiveWorkspaceRuntimeProvider } from './live-workspace-runtime-provider'

export function LiveWorkspacePage() {
  const { campaign } = useCampaign()
  const campaignPanelSource = useLiveCampaignPanelSource()
  const { openCampaignsDashboard } = useLiveWorkspaceNavigation()

  return (
    <LiveWorkspaceRuntimeProvider>
      {(runtime) => (
        <ResourceShell
          ariaLabel="Editor workspace"
          runtime={runtime}
          resourcePanelSlots={{
            headerStart: <CampaignPlayersButton />,
            headerEnd: <UserMenu />,
            footer: (
              <CampaignPanel
                source={campaignPanelSource}
                onSwitchCampaign={() => {
                  void openCampaignsDashboard()
                }}
              />
            ),
          }}
          workspaceName={campaign.data?.name ?? null}
        />
      )}
    </LiveWorkspaceRuntimeProvider>
  )
}
