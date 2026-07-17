import type { NoteBlockId } from '../resources/domain-id'

export type NoteHeadingNavigation = (blockId: NoteBlockId) => void

export type NoteHeadingNavigationRef = {
  current: NoteHeadingNavigation | null
}
