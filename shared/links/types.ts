export type LinkSyntax = 'wiki' | 'md'
export type LinkPathKind = 'global' | 'relative'

export type ParsedLinkData = {
  syntax: LinkSyntax
  pathKind: LinkPathKind
  itemPath: Array<string>
  itemName: string
  headingPath: Array<string>
  displayName: string | null
  rawTarget: string
  isExternal: boolean
}

export type ResolvedLink<TItemId = string> = ParsedLinkData & {
  resolved: boolean
  itemId: TItemId | null
  href: string | null
  color: string | null
}

export type LinkResolvableItem<TItemId = string> = {
  _id: TItemId
  name: string
  parentId: TItemId | null
}
