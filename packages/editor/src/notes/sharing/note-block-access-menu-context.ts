import { createContext, use } from 'react'
import type { CampaignMemberId, NoteBlockId, ResourceId } from '../../resources/domain-id'
import type { NoteBlockAccessCommand } from '../../resources/resource-command-contract'
import type { ResourceKnowledge } from '../../resources/resource-index-contract'
import type { NoteBlockAccessPresentation } from '../../resources/note-block-access-policy'

export type NoteBlockAccessMenuState = Readonly<{
  blockIds: ReadonlyArray<NoteBlockId>
  kind: 'context' | 'sharing'
  position: Readonly<{ x: number; y: number }>
  sideMenu: Readonly<{
    freezeMenu: () => void
    unfreezeMenu: () => void
  }>
  title: string
}>

type NoteBlockAccessMenuRuntime = Readonly<{
  error: boolean
  knowledge: ResourceKnowledge<NoteBlockAccessPresentation>
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
