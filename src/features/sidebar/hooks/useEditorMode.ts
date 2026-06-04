import { convexQuery } from '@convex-dev/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { EDITOR_MODE } from 'shared/editor/types'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import type { Id } from 'convex/_generated/dataModel'
import type { Editor, EditorMode } from 'shared/editor/types'
import { getCampaignActorViewAsMemberId } from 'shared/campaigns/actor'
import type { CampaignActor } from 'shared/campaigns/actor'
import { handleError } from '~/shared/utils/logger'
import { useCampaignActor } from '~/features/campaigns/hooks/useCampaignActor'
import { actorCanMutateSidebarItem } from '~/features/sharing/utils/permission-utils'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { useFileSystemReadModel } from '~/features/filesystem/useFileSystemReadModel'

interface EditorModeContextType {
  editorMode: EditorMode
  campaignActor: CampaignActor | null
  viewAsPlayerId: Id<'campaignMembers'> | undefined
  canEdit: boolean
  setEditorMode: (editorMode: EditorMode) => void
  setViewAsPlayerId: (playerId: Id<'campaignMembers'> | undefined) => void
}

export function useEditorMode(): EditorModeContextType {
  const { isDm, campaignId } = useCampaign()
  const { item: currentItem } = useCurrentItem()
  const queryClient = useQueryClient()
  const campaignActor = useCampaignActor()
  const { allItemsById } = useFileSystemReadModel()

  const editorQuery = useCampaignQuery(api.editors.queries.getCurrentEditor, {})

  const setEditorMutation = useCampaignMutation(api.editors.mutations.setCurrentEditor, {
    onMutate: async ({ editorMode: newMode }) => {
      if (!campaignId || !newMode) return

      const queryOptions = convexQuery(api.editors.queries.getCurrentEditor, {
        campaignId,
      })

      await queryClient.cancelQueries({ queryKey: queryOptions.queryKey })

      const previous = queryClient.getQueryData<Editor>(queryOptions.queryKey)

      queryClient.setQueryData(queryOptions.queryKey, (old: Editor | null | undefined) => {
        if (!old) return old
        return { ...old, editorMode: newMode }
      })

      return { previous, queryKey: queryOptions.queryKey }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous)
      }
      handleError(err, 'Failed to update editor mode')
    },
    onSettled: () => {
      if (!campaignId) return
      const queryOptions = convexQuery(api.editors.queries.getCurrentEditor, {
        campaignId,
      })
      void queryClient.invalidateQueries({ queryKey: queryOptions.queryKey })
    },
  })

  const setViewAsPlayer = useSidebarUIStore((s) => s.setViewAsPlayer)

  const rawEditorMode = editorQuery.data?.editorMode ?? EDITOR_MODE.EDITOR

  const isDeleted = currentItem?.isTrashed === true
  const canEdit =
    !isDeleted &&
    !!currentItem &&
    actorCanMutateSidebarItem(currentItem, PERMISSION_LEVEL.EDIT, {
      actor: campaignActor,
      allItemsMap: allItemsById,
    })
  const effectiveEditorMode = canEdit ? rawEditorMode : EDITOR_MODE.VIEWER
  const mutate = setEditorMutation.mutate

  const setEditorMode = (mode: EditorMode) => {
    if (!canEdit || !campaignId) return
    mutate({ editorMode: mode })
  }

  const setViewAsPlayerId = (playerId: Id<'campaignMembers'> | undefined) => {
    if (!isDm || !campaignId) return
    setViewAsPlayer(playerId ? { campaignId, memberId: playerId } : null)
  }

  return {
    editorMode: effectiveEditorMode,
    campaignActor,
    viewAsPlayerId: getCampaignActorViewAsMemberId(campaignActor),
    canEdit,
    setEditorMode,
    setViewAsPlayerId,
  }
}
