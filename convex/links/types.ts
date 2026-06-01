import type { Id } from '../_generated/dataModel'
import type {
  LinkPathKind as SharedLinkPathKind,
  LinkSyntax as SharedLinkSyntax,
  ParsedLinkData as SharedParsedLinkData,
  ResolvedLink as SharedResolvedLink,
} from '../../shared/links/types'

export type LinkPathKind = SharedLinkPathKind
export type LinkSyntax = SharedLinkSyntax
export type ParsedLinkData = SharedParsedLinkData
export type ResolvedLink = SharedResolvedLink

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
