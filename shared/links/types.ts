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
