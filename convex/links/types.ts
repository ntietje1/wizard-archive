import type { Id } from '../_generated/dataModel'

export type LinkSyntax = 'wiki' | 'md'

export type ParsedLinkData = {
  syntax: LinkSyntax
  itemPath: Array<string>
  itemName: string
  headingPath: Array<string>
  displayName: string | null
  rawTarget: string
  isExternal: boolean
}

export type ResolvedLink = ParsedLinkData & {
  resolved: boolean
  itemId: Id<'sidebarItems'> | null
  href: string | null
  color: string | null
}

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
