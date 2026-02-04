import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import type { PermissionLevel } from 'convex/shares/types'
import {
  EditorModeActionsContext,
  EditorModeStateContext,
} from '~/hooks/useEditorMode'
import { useCampaign } from '~/hooks/useCampaign'
import { useCurrentItem } from '~/hooks/useCurrentItem'

export type EditorMode = 'viewer' | 'editor'

export function EditorModeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { campaignWithMembership, isDm } = useCampaign()
  const [editorMode, setEditorModeState] = useState<EditorMode>('editor')
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
    ? 'full_access'
    : (permissionQuery.data ?? 'none')

  const canEdit =
    permissionLevel === 'edit' || permissionLevel === 'full_access'

  const stateValue = useMemo(
    () => ({
      editorMode: isDm
        ? editorMode
        : canEdit
          ? 'editor'
          : ('viewer' as EditorMode),
      viewAsPlayerId: isDm
        ? viewAsPlayerId
        : canEdit
          ? undefined
          : campaignWithMembership.data?.member._id,
      permissionLevel,
      isPermissionLoading,
    }),
    [
      editorMode,
      viewAsPlayerId,
      isDm,
      canEdit,
      permissionLevel,
      isPermissionLoading,
      campaignWithMembership.data?.member._id,
    ],
  )

  const setEditorMode = useCallback(
    (mode: EditorMode) => {
      if (isDm) setEditorModeState(mode)
    },
    [isDm],
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
