import { WizardEditor, createBrowserWizardEditorViewStateStores } from '@wizard-archive/editor'
import { useMatch, useNavigate, useRouteContext } from '@tanstack/react-router'
import { api } from 'convex/_generated/api'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { CampaignPanel } from '~/features/campaigns/components/campaign-panel/campaign-panel'
import { CampaignPlayersButton } from '~/features/campaigns/components/campaign-players-button'
import { UserMenu } from '~/features/auth/components/user-menu'
import { useLiveCampaignPanelSource } from '~/features/campaigns/runtime/use-live-campaign-panel-source'
import { useLiveWorkspaceNavigation } from '~/editor-adapters/live/use-live-workspace-navigation'
import { useAppMutation } from '~/shared/hooks/useAppMutation'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'
import { handleError } from '~/shared/utils/logger'
import { useLiveSidebarSortOptions } from './sidebar/use-live-sidebar-sort-options'
import { LiveWorkspaceRuntimeProvider } from './live-workspace-runtime-provider'
import { EDITOR_ROUTE, EDITOR_ROUTE_ID } from './editor-route'

export function LiveWorkspacePage() {
  const { campaign } = useCampaign()
  const campaignPanelSource = useLiveCampaignPanelSource()
  const panelPreferences = useLiveWorkspacePanelPreferencesSource()
  const { openCampaignsDashboard } = useLiveWorkspaceNavigation()
  const noteHeadingRequest = useLiveWorkspaceHeadingRequest()
  const sidebarSort = useLiveSidebarSortOptions()

  return (
    <LiveWorkspaceRuntimeProvider>
      {(runtime) => (
        <WizardEditor
          ariaLabel="Editor workspace"
          noteHeadingRequest={noteHeadingRequest}
          panelPreferences={panelPreferences}
          runtime={runtime}
          sidebar="resizable"
          sidebarSlots={{
            railStartControls: <CampaignPlayersButton />,
            railEndControls: <UserMenu />,
            bottomPanel: (
              <CampaignPanel
                source={campaignPanelSource}
                onSwitchCampaign={() => {
                  void openCampaignsDashboard()
                }}
              />
            ),
          }}
          sidebarSort={sidebarSort}
          viewStateStores={createBrowserWizardEditorViewStateStores({
            namespace: runtime.workspace.instanceId,
          })}
          workspaceName={campaign.data?.name ?? null}
        />
      )}
    </LiveWorkspaceRuntimeProvider>
  )
}

function useLiveWorkspacePanelPreferencesSource() {
  const { initialPanelPreferences } = useRouteContext({
    from: '/_app',
  })
  const prefsQuery = useAuthQuery(api.userPreferences.queries.getUserPreferences, {})
  const setPanelPreference = useAppMutation(api.userPreferences.mutations.setPanelPreference, {
    onError: (error) => {
      handleError(error, 'Failed to save panel preference')
    },
  })

  return {
    appliedPanelPreferences: prefsQuery.data?.panelPreferences ?? null,
    initialPanelPreferences,
    isLoaded: prefsQuery.isSuccess || prefsQuery.isError,
    onPanelPreferenceChange: async (
      preference: Parameters<typeof setPanelPreference.mutateAsync>[0],
    ) => {
      await setPanelPreference.mutateAsync(preference)
    },
  }
}

function useLiveWorkspaceHeadingRequest() {
  const editorMatch = useMatch({
    from: EDITOR_ROUTE_ID,
    shouldThrow: false,
  })
  const heading = editorMatch?.search?.heading
  const searchItem = editorMatch?.search?.item
  const searchTrash = editorMatch?.search?.trash
  const navigate = useNavigate()
  const { campaignId } = useCampaign()

  return {
    heading,
    onConsumed: () => {
      void navigate({
        to: EDITOR_ROUTE,
        params: { campaignId },
        search: searchItem ? { item: searchItem } : searchTrash ? { trash: true } : {},
        replace: true,
      })
    },
  }
}
