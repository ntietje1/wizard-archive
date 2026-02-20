import { useCallback } from 'react'
import { EDITOR_MODE } from 'convex/editors/types'
import { PERMISSION_LEVEL } from 'convex/shares/types'
import { hasAtLeastPermissionLevel } from 'convex/shares/itemShares'
import type { Id } from 'convex/_generated/dataModel'
import type { EditorMode } from 'convex/editors/types'
import {
  useCampaignEditorState,
  useEditorModeStore,
} from '~/stores/editorModeStore'
import { useCampaign } from '~/hooks/useCampaign'
import { useCurrentItem } from '~/hooks/useCurrentItem'

export interface EditorModeContextType {
  editorMode: EditorMode
  viewAsPlayerId: Id<'campaignMembers'> | undefined
  canEdit: boolean
  setEditorMode: (editorMode: EditorMode) => void
  setViewAsPlayerId: (playerId: Id<'campaignMembers'> | undefined) => void
}

export function useEditorMode(): EditorModeContextType {
  const { isDm, campaignSlug, dmUsername } = useCampaign()
  const campaignKey = `${dmUsername}/${campaignSlug}`

  const { editorMode: rawEditorMode, viewAsPlayerId } =
    useCampaignEditorState(campaignKey)
  const { item: currentItem } = useCurrentItem()

  const canEdit = hasAtLeastPermissionLevel(
    currentItem?.myPermissionLevel ?? PERMISSION_LEVEL.NONE,
    PERMISSION_LEVEL.EDIT,
  )
  const effectiveEditorMode = canEdit ? rawEditorMode : EDITOR_MODE.VIEWER

  const storeSetEditorMode = useEditorModeStore((s) => s.setEditorMode)
  const storeSetViewAsPlayerId = useEditorModeStore((s) => s.setViewAsPlayerId)

  const setEditorMode = useCallback(
    (mode: EditorMode) => {
      if (canEdit) storeSetEditorMode(campaignKey, mode)
    },
    [canEdit, campaignKey, storeSetEditorMode],
  )

  const setViewAsPlayerId = useCallback(
    (playerId: Id<'campaignMembers'> | undefined) => {
      if (isDm) storeSetViewAsPlayerId(campaignKey, playerId)
    },
    [isDm, campaignKey, storeSetViewAsPlayerId],
  )

  return {
    editorMode: effectiveEditorMode,
    viewAsPlayerId: isDm ? viewAsPlayerId : undefined,
    canEdit,
    setEditorMode,
    setViewAsPlayerId,
  }
}
