import { useCallback, useMemo, useState } from 'react'
import type { Id } from 'convex/_generated/dataModel'
import {
  EditorModeActionsContext,
  EditorModeStateContext,
} from '~/hooks/useEditorMode'
import { useCampaign } from '~/hooks/useCampaign'

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

  const stateValue = useMemo(
    () => ({
      editorMode: isDm ? editorMode : 'viewer',
      viewAsPlayerId: isDm
        ? viewAsPlayerId
        : campaignWithMembership.data?.member._id,
    }),
    [editorMode, viewAsPlayerId, isDm, campaignWithMembership.data?.member._id],
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
