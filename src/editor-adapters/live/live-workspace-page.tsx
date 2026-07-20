import { useSyncExternalStore } from 'react'
import { ResourceShell } from '@wizard-archive/editor/resources/resource-shell'
import { ResourceViewAsMenu } from '@wizard-archive/editor/resources/view-as-menu'
import type { EditorRuntime } from '@wizard-archive/editor/resources/editor-runtime-contract'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { CampaignPanel } from '~/features/campaigns/components/campaign-panel/campaign-panel'
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
            headerEnd: <UserMenu />,
            footer: (
              <CampaignPanel
                source={campaignPanelSource}
                workspaceControls={<LiveWorkspaceViewAsMenu runtime={runtime} />}
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

function LiveWorkspaceViewAsMenu({ runtime }: { runtime: EditorRuntime }) {
  const preferences = useSyncExternalStore(
    (listener) => runtime.preferences.subscribe(listener),
    () => runtime.preferences.get(),
    () => runtime.preferences.get(),
  )
  if (preferences.status !== 'ready') return null
  const viewAs = runtime.viewAs.status === 'available' ? runtime.viewAs.value : null
  return (
    <ResourceViewAsMenu
      mode={preferences.value.mode}
      participants={viewAs?.participants}
      pending={viewAs?.pending}
      presentation="menu-item"
      projection={runtime.scope.projection}
      selectedParticipantId={viewAs?.selectedParticipantId}
      onModeChange={(mode) => {
        void runtime.preferences.patch({ field: 'mode', value: mode })
      }}
      onParticipantChange={(participantId) => viewAs?.select(participantId)}
    />
  )
}
