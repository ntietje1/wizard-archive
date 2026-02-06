import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { PERMISSION_LEVEL } from 'convex/shares/types'
import { hasAtLeastPermissionLevel } from 'convex/shares/itemShares'
import { EDITOR_MODE } from 'convex/editors/types'
import type { EditorMode } from 'convex/editors/types'
import type { PermissionLevel } from 'convex/shares/types'
import type { Id } from 'convex/_generated/dataModel'
import {
  EditorModeActionsContext,
  EditorModeStateContext,
} from '~/hooks/useEditorMode'
import { useCampaign } from '~/hooks/useCampaign'
import { useCurrentItem } from '~/hooks/useCurrentItem'

export function EditorModeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { campaignWithMembership, isDm } = useCampaign()
  const [editorMode, setEditorModeState] = useState<EditorMode>(
    EDITOR_MODE.EDITOR,
  )
  const [viewAsPlayerId, setViewAsPlayerIdState] = useState<
    Id<'campaignMembers'> | undefined
  >(undefined)

  const { item: currentItem } = useCurrentItem()
  const campaignId = campaignWithMembership.data?.campaign._id

  // Query the current user's permission level on the current item
  const permissionQuery = useQuery(
    convexQuery(
      api.shares.queries.getMyPermissionLevel,
      campaignId && currentItem?._id
        ? { campaignId, sidebarItemId: currentItem._id }
        : 'skip',
    ),
  )

  const isPermissionLoading = !isDm && permissionQuery.isPending
  const permissionLevel: PermissionLevel = isDm
    ? PERMISSION_LEVEL.FULL_ACCESS
    : (permissionQuery.data ?? PERMISSION_LEVEL.NONE)

  const canEdit = hasAtLeastPermissionLevel(
    permissionLevel,
    PERMISSION_LEVEL.EDIT,
  )
  const effectiveEditorMode = isDm || canEdit ? editorMode : EDITOR_MODE.VIEWER

  const stateValue = useMemo(
    () => ({
      editorMode: effectiveEditorMode,
      viewAsPlayerId: isDm ? viewAsPlayerId : undefined,
      canEdit,
      permissionLevel,
      isPermissionLoading,
    }),
    [
      effectiveEditorMode,
      viewAsPlayerId,
      isDm,
      canEdit,
      permissionLevel,
      isPermissionLoading,
    ],
  )

  const setEditorMode = useCallback(
    (mode: EditorMode) => {
      if (isDm || canEdit) setEditorModeState(mode)
    },
    [isDm, canEdit],
  )

  const setViewAsPlayerId = useCallback(
    (playerId: Id<'campaignMembers'> | undefined) => {
      if (isDm) setViewAsPlayerIdState(playerId)
    },
    [isDm],
  )

  const actionsValue = useMemo(
    () => ({
      setEditorMode,
      setViewAsPlayerId,
    }),
    [setEditorMode, setViewAsPlayerId],
  )

  return (
    <EditorModeActionsContext.Provider value={actionsValue}>
      <EditorModeStateContext.Provider value={stateValue}>
        {children}
      </EditorModeStateContext.Provider>
    </EditorModeActionsContext.Provider>
  )
}
