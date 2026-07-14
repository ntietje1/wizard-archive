import { useQueryClient } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { WORKSPACE_MODE } from 'shared/workspace/workspace-mode'
import type { CampaignMemberId } from '@wizard-archive/editor/resources/domain-id'
import type { WorkspaceMode } from 'shared/workspace/workspace-mode'
import { liveWorkspacePreferencesQuery } from './live-workspace-preferences'
import type { LiveWorkspacePreferences } from './live-workspace-preferences'
import { getCampaignActorViewAsMemberId } from 'shared/campaigns/actor'
import type { CampaignActor } from 'shared/campaigns/actor'
import type { WizardEditorItem, WizardEditorWorkspaceActor } from '@wizard-archive/editor/adapter'
import { handleError } from '~/shared/utils/logger'
import { useCampaignActor } from '~/features/campaigns/hooks/useCampaignActor'
import { resolveWizardEditorWorkspaceModeForItem } from '@wizard-archive/editor/adapter'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCampaignViewAsStore } from '~/features/campaigns/state/campaign-view-as-store'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import type { SidebarItemId } from 'shared/common/ids'
import { toEditorWorkspaceActor } from './workspace-actor'

interface WorkspaceModeContextType {
  workspaceMode: WorkspaceMode
  campaignActor: CampaignActor | null
  workspaceActor: WizardEditorWorkspaceActor | null
  viewAsPlayerId: CampaignMemberId | undefined
  canEdit: boolean
  setWorkspaceMode: (workspaceMode: WorkspaceMode) => void
  setViewAsPlayerId: (playerId: CampaignMemberId | undefined) => void
}

export function useLiveWorkspaceMode(
  currentItem: WizardEditorItem | null,
  getItemById: (itemId: SidebarItemId) => WizardEditorItem | null | undefined,
): WorkspaceModeContextType {
  const { isDm, campaignId: workspaceRecordId } = useCampaign()
  const queryClient = useQueryClient()
  const campaignActor = useCampaignActor()
  const workspaceActor = toEditorWorkspaceActor(campaignActor)

  const editorQuery = useCampaignQuery(api.editors.queries.getCurrentEditor, {})

  const setEditorMutation = useCampaignMutation(api.editors.mutations.setCurrentEditor, {
    onMutate: async ({ editorMode: newMode }) => {
      if (!workspaceRecordId || !newMode) return

      const queryOptions = liveWorkspacePreferencesQuery(workspaceRecordId)

      await queryClient.cancelQueries({ queryKey: queryOptions.queryKey })

      const previousEditorMode = queryClient.getQueryData<LiveWorkspacePreferences>(
        queryOptions.queryKey,
      )?.editorMode

      queryClient.setQueryData(
        queryOptions.queryKey,
        (old: LiveWorkspacePreferences | null | undefined) => {
          if (!old) return old
          return { ...old, editorMode: newMode }
        },
      )

      return { previousEditorMode, queryKey: queryOptions.queryKey }
    },
    onError: (err, _vars, context) => {
      if (context?.previousEditorMode) {
        queryClient.setQueryData(
          context.queryKey,
          (current: LiveWorkspacePreferences | null | undefined) =>
            current ? { ...current, editorMode: context.previousEditorMode } : current,
        )
      }
      handleError(err, 'Failed to update editor mode')
    },
    onSettled: (_data, _error, _vars, context) => {
      if (context) {
        void queryClient.invalidateQueries({ queryKey: context.queryKey })
        return
      }
      if (!workspaceRecordId) return
      void queryClient.invalidateQueries({
        queryKey: liveWorkspacePreferencesQuery(workspaceRecordId).queryKey,
      })
    },
  })

  const setViewAsPlayer = useCampaignViewAsStore((s) => s.setViewAsPlayer)

  const rawWorkspaceMode = editorQuery.data?.editorMode ?? WORKSPACE_MODE.EDITOR

  const { canEdit, workspaceMode: effectiveWorkspaceMode } =
    resolveWizardEditorWorkspaceModeForItem({
      actor: workspaceActor,
      currentItem,
      getItemById: (itemId) => getItemById(itemId as SidebarItemId),
      rawWorkspaceMode,
    })
  const mutate = setEditorMutation.mutate
  const canSetWorkspaceMode = campaignActor !== null && campaignActor.kind !== 'dm_view_as'

  const setWorkspaceMode = (mode: WorkspaceMode) => {
    if (!canSetWorkspaceMode || !workspaceRecordId) return
    mutate({ editorMode: mode })
  }

  const setViewAsPlayerId = (playerId: CampaignMemberId | undefined) => {
    if (!isDm || !workspaceRecordId) return
    setViewAsPlayer(playerId ? { campaignId: workspaceRecordId, memberId: playerId } : null)
  }

  return {
    workspaceMode: effectiveWorkspaceMode,
    campaignActor,
    workspaceActor,
    viewAsPlayerId: getCampaignActorViewAsMemberId(campaignActor),
    canEdit,
    setWorkspaceMode,
    setViewAsPlayerId,
  }
}
