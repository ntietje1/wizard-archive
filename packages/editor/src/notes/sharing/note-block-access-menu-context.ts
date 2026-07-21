import { createContext, use, useCallback, useSyncExternalStore } from 'react'
import type { CampaignMemberId, NoteBlockId, ResourceId } from '../../resources/domain-id'
import type { NoteBlockAccessCommand } from '../../resources/resource-command-contract'
import type { NoteBlockAccessGateway } from '../../resources/editor-runtime-contract'
import type { ResourceKnowledge } from '../../resources/resource-index-contract'
import { normalizeNoteBlockAccessSelection } from '../../resources/note-block-access-policy'
import type { NoteBlockAccessPresentation } from '../../resources/note-block-access-policy'

const UNKNOWN_PRESENTATION: ResourceKnowledge<NoteBlockAccessPresentation> = { state: 'unknown' }

export type NoteBlockAccessMenuState = Readonly<{
  blockIds: ReadonlyArray<NoteBlockId>
  kind: 'context' | 'sharing'
  position: Readonly<{ x: number; y: number }>
  source:
    | Readonly<{ kind: 'editor' }>
    | Readonly<{
        kind: 'side-menu'
        controls: Readonly<{
          freezeMenu: () => void
          unfreezeMenu: () => void
        }>
      }>
  title: string
}>

type NoteBlockAccessMenuRuntime = Readonly<{
  error: boolean
  gateway: NoteBlockAccessGateway
  noteId: ResourceId
  pending: boolean
  execute: (command: NoteBlockAccessCommand) => Promise<boolean>
  shareNote: ((memberId: CampaignMemberId) => Promise<boolean>) | null
  open: (menu: NoteBlockAccessMenuState) => void
}>

export const NoteBlockAccessMenuContext = createContext<NoteBlockAccessMenuRuntime | null>(null)

export function useNoteBlockAccessMenu() {
  return use(NoteBlockAccessMenuContext)
}

export function useNoteBlockAccessKnowledge(
  gateway: NoteBlockAccessGateway | null,
  noteId: ResourceId | null,
  blockIds: ReadonlyArray<NoteBlockId>,
) {
  const selection = blockIds.length > 0 ? normalizeNoteBlockAccessSelection(blockIds) : []
  const selectionKey = selection.join('\0')
  const subscribe = useCallback(
    (listener: () => void) =>
      gateway && noteId && selectionKey
        ? gateway.subscribe(noteId, readSelectionKey(selectionKey), listener)
        : () => undefined,
    [gateway, noteId, selectionKey],
  )
  const getSnapshot = useCallback(
    () =>
      gateway && noteId && selectionKey
        ? gateway.getPresentation(noteId, readSelectionKey(selectionKey))
        : UNKNOWN_PRESENTATION,
    [gateway, noteId, selectionKey],
  )
  return useSyncExternalStore(subscribe, getSnapshot, () => UNKNOWN_PRESENTATION)
}

function readSelectionKey(key: string): ReadonlyArray<NoteBlockId> {
  return key.split('\0') as Array<NoteBlockId>
}
