import { useCallback } from 'react'
import { convexQuery } from '@convex-dev/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { api } from 'convex/_generated/api'
import { EDITOR_MODE } from 'convex/editors/types'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { hasAtLeastPermissionLevel } from 'convex/permissions/hasAtLeastPermissionLevel'
import type { Id } from 'convex/_generated/dataModel'
import type { Editor, EditorMode } from 'convex/editors/types'
import { useAppMutation } from '~/hooks/useAppMutation'
import { useAuthQuery } from '~/hooks/useAuthQuery'
import { useCampaign } from '~/hooks/useCampaign'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'

export interface EditorModeContextType {
  editorMode: EditorMode
  viewAsPlayerId: Id<'campaignMembers'> | undefined
  canEdit: boolean
  setEditorMode: (editorMode: EditorMode) => void
  setViewAsPlayerId: (playerId: Id<'campaignMembers'> | undefined) => void
}

export function useEditorMode(): EditorModeContextType {
  const { isDm, campaign } = useCampaign()
  const campaignData = campaign.data
  const { item: currentItem } = useCurrentItem()
  const queryClient = useQueryClient()

  const editorQuery = useAuthQuery(
    api.editors.queries.getCurrentEditor,
    campaignData?._id ? { campaignId: campaignData._id } : 'skip',
  )

  const setEditorMutation = useAppMutation(
    api.editors.mutations.setCurrentEditor,
    {
      errorMessage: 'Failed to update editor',
      onMutate: async ({ editorMode: newMode }) => {
        if (!campaignData?._id || !newMode) return

        const queryOptions = convexQuery(api.editors.queries.getCurrentEditor, {
          campaignId: campaignData._id,
        })

        await queryClient.cancelQueries({ queryKey: queryOptions.queryKey })

        const previous = queryClient.getQueryData<Editor>(queryOptions.queryKey)

        queryClient.setQueryData(
          queryOptions.queryKey,
          (old: Editor | null | undefined) => {
            if (!old) return old
            return { ...old, editorMode: newMode }
          },
        )

        return { previous, queryKey: queryOptions.queryKey }
      },
      onError: (_err, _vars, context) => {
        if (context?.previous) {
          queryClient.setQueryData(context.queryKey, context.previous)
        }
      },
      onSettled: () => {
        if (!campaignData?._id) return
        const queryOptions = convexQuery(api.editors.queries.getCurrentEditor, {
          campaignId: campaignData._id,
        })
        queryClient.invalidateQueries({ queryKey: queryOptions.queryKey })
      },
    },
  )

  const viewAsPlayerId = useSidebarUIStore((s) => s.viewAsPlayerId)
  const setViewAsPlayerIdStore = useSidebarUIStore((s) => s.setViewAsPlayerId)

  const rawEditorMode = editorQuery.data?.editorMode ?? EDITOR_MODE.EDITOR

  const isDeleted = !!currentItem?.deletionTime
  const canEdit =
    !isDeleted &&
    hasAtLeastPermissionLevel(
      currentItem?.myPermissionLevel ?? PERMISSION_LEVEL.NONE,
      PERMISSION_LEVEL.EDIT,
    )
  const effectiveEditorMode = canEdit ? rawEditorMode : EDITOR_MODE.VIEWER
  const mutate = setEditorMutation.mutate

  const setEditorMode = useCallback(
    (mode: EditorMode) => {
      if (!canEdit || !campaignData?._id) return
      mutate({
        campaignId: campaignData._id,
        editorMode: mode,
      })
    },
    [canEdit, campaignData?._id, mutate],
  )

  const setViewAsPlayerId = useCallback(
    (playerId: Id<'campaignMembers'> | undefined) => {
      if (isDm) setViewAsPlayerIdStore(playerId ?? null)
    },
    [isDm, setViewAsPlayerIdStore],
  )

  return {
    editorMode: effectiveEditorMode,
    viewAsPlayerId: isDm && viewAsPlayerId ? viewAsPlayerId : undefined,
    canEdit,
    setEditorMode,
    setViewAsPlayerId,
  }
}
