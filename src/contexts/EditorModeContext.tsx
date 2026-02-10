import { useCallback, useMemo, useState } from 'react'
import { PERMISSION_LEVEL } from 'convex/shares/types'
import { hasAtLeastPermissionLevel } from 'convex/shares/itemShares'
import { EDITOR_MODE } from 'convex/editors/types'
import type { EditorMode } from 'convex/editors/types'
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
  const { isDm } = useCampaign()
  const [editorMode, setEditorModeState] = useState<EditorMode>(
    EDITOR_MODE.EDITOR,
  )
  const [viewAsPlayerId, setViewAsPlayerIdState] = useState<
    Id<'campaignMembers'> | undefined
  >(undefined)

  const { item: currentItem } = useCurrentItem()

  const canEdit = hasAtLeastPermissionLevel(
    currentItem?.myPermissionLevel ?? PERMISSION_LEVEL.NONE,
    PERMISSION_LEVEL.EDIT,
  )
  const effectiveEditorMode = canEdit ? editorMode : EDITOR_MODE.VIEWER

  const stateValue = useMemo(
    () => ({
      editorMode: effectiveEditorMode,
      viewAsPlayerId: isDm ? viewAsPlayerId : undefined,
      canEdit,
    }),
    [effectiveEditorMode, viewAsPlayerId, isDm, canEdit],
  )

  const setEditorMode = useCallback(
    (mode: EditorMode) => {
      if (canEdit) setEditorModeState(mode)
    },
    [canEdit],
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
