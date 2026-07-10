import type { Id } from '../_generated/dataModel'
import type { LinkSyntax } from '../../shared/links/types'

export type NoteLink = {
  _id: Id<'noteLinks'>
  _creationTime: number
  sourceNoteId: Id<'sidebarItems'>
  targetItemId: Id<'sidebarItems'> | null
  query: string
  displayName: string | null
  syntax: LinkSyntax
  campaignId: Id<'campaigns'>
  blockId: Id<'blocks'>
}
