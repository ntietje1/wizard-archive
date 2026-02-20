import { useShallow } from 'zustand/shallow'
import { create } from 'zustand'
import { EDITOR_MODE } from 'convex/editors/types'
import type { EditorMode } from 'convex/editors/types'
import type { Id } from 'convex/_generated/dataModel'

interface CampaignEditorState {
  editorMode: EditorMode
  viewAsPlayerId: Id<'campaignMembers'> | undefined
}

interface EditorModeStoreState {
  campaignStates: Record<string, CampaignEditorState>
}

interface EditorModeStoreActions {
  setEditorMode: (campaignKey: string, mode: EditorMode) => void
  setViewAsPlayerId: (
    campaignKey: string,
    id: Id<'campaignMembers'> | undefined,
  ) => void
}

const defaultCampaignState: CampaignEditorState = {
  editorMode: EDITOR_MODE.EDITOR,
  viewAsPlayerId: undefined,
}

function getCampaignState(
  state: EditorModeStoreState,
  campaignKey: string,
): CampaignEditorState {
  return state.campaignStates[campaignKey] ?? defaultCampaignState
}

function updateCampaignState(
  state: EditorModeStoreState,
  campaignKey: string,
  update: Partial<CampaignEditorState>,
): Partial<EditorModeStoreState> {
  const prev = getCampaignState(state, campaignKey)
  return {
    campaignStates: {
      ...state.campaignStates,
      [campaignKey]: { ...prev, ...update },
    },
  }
}

export const useEditorModeStore = create<
  EditorModeStoreState & EditorModeStoreActions
>()((set) => ({
  campaignStates: {},
  setEditorMode: (campaignKey, mode) =>
    set((state) =>
      updateCampaignState(state, campaignKey, { editorMode: mode }),
    ),
  setViewAsPlayerId: (campaignKey, id) =>
    set((state) =>
      updateCampaignState(state, campaignKey, { viewAsPlayerId: id }),
    ),
}))

export function useCampaignEditorState(campaignKey: string | undefined) {
  return useEditorModeStore(
    useShallow((s) => {
      const cs = campaignKey ? s.campaignStates[campaignKey] : undefined
      return {
        editorMode: cs?.editorMode ?? EDITOR_MODE.EDITOR,
        viewAsPlayerId: cs?.viewAsPlayerId,
      }
    }),
  )
}
