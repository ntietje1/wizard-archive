import { convexQuery } from '@convex-dev/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { EDITOR_MODE } from 'convex/editors/types'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import { hasAtLeastPermissionLevel } from 'convex/permissions/hasAtLeastPermissionLevel'
import type { Id } from 'convex/_generated/dataModel'
import type { Editor, EditorMode } from 'convex/editors/types'
import { handleError } from '~/shared/utils/logger'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCurrentItem } from '~/features/sidebar/hooks/useCurrentItem'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'

export interface EditorModeContextType {
  editorMode: EditorMode
  viewAsPlayerId: Id<'campaignMembers'> | undefined
  canEdit: boolean
  setEditorMode: (editorMode: EditorMode) => void
  setViewAsPlayerId: (playerId: Id<'campaignMembers'> | undefined) => void
}

export function useEditorMode(): EditorModeContextType {
  const { isDm, campaignId } = useCampaign()
  const { item: currentItem } = useCurrentItem()
  const queryClient = useQueryClient()

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

  const viewAsPlayerId = useSidebarUIStore((s) => s.viewAsPlayerId)
  const setViewAsPlayerIdStore = useSidebarUIStore((s) => s.setViewAsPlayerId)

  const rawEditorMode = editorQuery.data?.editorMode ?? EDITOR_MODE.EDITOR

  const isDeleted = currentItem?.location === SIDEBAR_ITEM_LOCATION.trash
  const canEdit =
    !isDeleted &&
    hasAtLeastPermissionLevel(
      currentItem?.myPermissionLevel ?? PERMISSION_LEVEL.NONE,
      PERMISSION_LEVEL.EDIT,
    )
  const effectiveEditorMode = canEdit ? rawEditorMode : EDITOR_MODE.VIEWER
  const mutate = setEditorMutation.mutate

  const setEditorMode = (mode: EditorMode) => {
    if (!canEdit || !campaignId) return
    mutate({ editorMode: mode })
  }

  const setViewAsPlayerId = (playerId: Id<'campaignMembers'> | undefined) => {
    if (isDm) setViewAsPlayerIdStore(playerId ?? null)
  }

  return {
    editorMode: effectiveEditorMode,
    viewAsPlayerId: isDm && viewAsPlayerId ? viewAsPlayerId : undefined,
    canEdit,
    setEditorMode,
    setViewAsPlayerId,
  }
}
