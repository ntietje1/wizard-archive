import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { AnyItem } from '../../workspace/items'
import type { NoteItem } from '../item-contract'
import type { ResourceKind } from '../../workspace/resource-contract'
import { parseWikiLinkText } from '../../../../../shared/links/parsing'
import type { Heading, HeadingLevel } from '../document/model'
import type { NoteValueRuntimeState } from '../values/state-contract'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { filterSuggestionItems } from '../../rich-text/filter-suggestion-items'

const SUGGESTION_LIMIT = 10

export interface FileSuggestion {
  kind: 'file'
  key: SidebarItemId
  title: string
  subtext: string
  badge: string
  item: AnyItem
  linkPath: Array<string>
}

export interface HeadingSuggestion {
  kind: 'heading'
  key: string
  title: string
  level: HeadingLevel
  fullPath: Array<string>
}

export interface ValueSuggestion {
  kind: 'value'
  key: string
  title: string
  slug: string
  formattedValue: string
  value: NoteValueRuntimeState<SidebarItemId>
}

interface DisplayNameAutocompleteContext {
  mode: 'display-name'
}

export interface FileAutocompleteContext {
  mode: 'file'
  pathKind: 'global' | 'relative'
  fileQuery: string
  completedFolderPath: Array<string>
  resolvedParentId: SidebarItemId | null | undefined
}

export interface HeadingAutocompleteContext {
  mode: 'heading'
  pathKind: 'global' | 'relative'
  fileQuery: string
  completedFolderPath: Array<string>
  headingQuery: string
  completedHeadingPath: Array<string>
  resolvedItem: NoteItem
}

export interface ValueAutocompleteContext {
  mode: 'value'
  notePathRaw: string
  valueQuery: string
  resolvedItem: NoteItem
}

export type AutocompleteContext =
  | DisplayNameAutocompleteContext
  | FileAutocompleteContext
  | HeadingAutocompleteContext
  | ValueAutocompleteContext

interface EmptyAutocompleteModel {
  mode: 'empty'
  suggestions: []
  totalCount: number
}

export type ActiveAutocompleteModel =
  | {
      mode: 'file'
      context: FileAutocompleteContext
      suggestions: Array<FileSuggestion>
      totalCount: number
    }
  | {
      mode: 'heading'
      context: HeadingAutocompleteContext
      suggestions: Array<HeadingSuggestion>
      totalCount: number
    }
  | {
      mode: 'value'
      context: ValueAutocompleteContext
      suggestions: Array<ValueSuggestion>
      totalCount: number
    }

type WikiLinkAutocompleteModel = EmptyAutocompleteModel | ActiveAutocompleteModel

type WikiLinkPathKind = 'global' | 'relative'

interface WikiLinkAutocompletePathInput {
  pathKind: WikiLinkPathKind
  pathSegments: Array<string>
  sourceItemId?: SidebarItemId
}

interface WikiLinkAutocompleteNotePathInput {
  text: string
  sourceItemId?: SidebarItemId
}

interface WikiLinkAutocompleteItemQuery {
  parentId?: SidebarItemId | null
}

export interface WikiLinkAutocompleteItemSource {
  getItemBreadcrumbs: (item: AnyItem) => string
  getItemLinkPath: (item: AnyItem) => ReadonlyArray<string>
  queryItems: (input?: WikiLinkAutocompleteItemQuery) => ReadonlyArray<AnyItem>
  resolveFolderPath: (input: WikiLinkAutocompletePathInput) => SidebarItemId | null | undefined
  resolveItemPath: (input: WikiLinkAutocompletePathInput) => AnyItem | null
  resolveNotePath: (input: WikiLinkAutocompleteNotePathInput) => NoteItem | null
}

export function getWikiLinkAutocompleteContextFromSource(
  query: string,
  itemSource: WikiLinkAutocompleteItemSource,
  sourceNoteId?: SidebarItemId,
): AutocompleteContext {
  if (query.includes('|')) {
    return {
      mode: 'display-name',
    }
  }

  const hashIdx = query.indexOf('#')
  if (hashIdx === -1) {
    const valueContext = getValueAutocompleteContextFromSource(query, itemSource, sourceNoteId)
    if (valueContext) {
      return valueContext
    }

    const { pathKind, completedFolderPath, fileQuery } = parseAutocompleteFileQuery(query)
    return {
      mode: 'file',
      pathKind,
      fileQuery,
      completedFolderPath,
      resolvedParentId: itemSource.resolveFolderPath({
        pathKind,
        pathSegments: completedFolderPath,
        sourceItemId: sourceNoteId,
      }),
    }
  }

  return getHeadingAutocompleteContextFromSource(query, hashIdx, itemSource, sourceNoteId)
}

export function buildWikiLinkAutocompleteModelFromSource({
  context,
  itemSource,
  headings,
  values = [],
}: {
  context: AutocompleteContext | null
  itemSource: WikiLinkAutocompleteItemSource
  headings: Array<Heading>
  values?: Array<NoteValueRuntimeState<SidebarItemId>>
}): WikiLinkAutocompleteModel {
  if (!context || context.mode === 'display-name') {
    return { mode: 'empty', suggestions: [], totalCount: 0 }
  }

  if (context.mode === 'heading') {
    const suggestions = buildHeadingSuggestions(
      headings,
      context.completedHeadingPath,
      context.headingQuery,
    )
    return {
      mode: 'heading',
      context,
      suggestions: suggestions.slice(0, SUGGESTION_LIMIT),
      totalCount: suggestions.length,
    }
  }

  if (context.mode === 'value') {
    const suggestions = buildValueSuggestions(values, context.valueQuery)
    return {
      mode: 'value',
      context,
      suggestions: suggestions.slice(0, SUGGESTION_LIMIT),
      totalCount: suggestions.length,
    }
  }

  const suggestions = buildFileSuggestionsFromSource(itemSource, context)
  return {
    mode: 'file',
    context,
    suggestions: suggestions.slice(0, SUGGESTION_LIMIT),
    totalCount: suggestions.length,
  }
}

export function buildValueReferenceText(
  suggestion: ValueSuggestion,
  context: ValueAutocompleteContext,
) {
  return `[[${context.notePathRaw}.${suggestion.slug}]]`
}

export function clampAutocompleteSelectedIndex(selectedIndex: number, suggestionCount: number) {
  if (suggestionCount <= 0) return 0
  return Math.min(Math.max(selectedIndex, 0), suggestionCount - 1)
}

export function buildInsertedFileLinkText(
  suggestion: FileSuggestion,
  context: FileAutocompleteContext,
  preservedDisplayName: string | null,
) {
  const pathParts = getFilePathParts(suggestion, context)
  const path = pathParts.join('/')
  const displayName = preservedDisplayName ?? (pathParts.length > 1 ? suggestion.title : null)
  return displayName ? `${path}|${displayName}` : path
}

export function buildInsertedHeadingLinkText(
  suggestion: HeadingSuggestion,
  context: HeadingAutocompleteContext,
  preservedDisplayName: string | null,
) {
  const headingTarget = `${context.fileQuery}#${buildHeadingPath(
    context.completedHeadingPath,
    suggestion,
  )}`
  return preservedDisplayName ? `${headingTarget}|${preservedDisplayName}` : headingTarget
}

export function buildContinuedFileLinkText(
  suggestion: FileSuggestion,
  context: FileAutocompleteContext,
) {
  return getFilePathParts(suggestion, context).join('/')
}

export function buildContinuedHeadingLinkText(
  suggestion: HeadingSuggestion,
  context: HeadingAutocompleteContext,
) {
  return `${context.fileQuery}#${buildHeadingPath(context.completedHeadingPath, suggestion)}`
}

export function buildContinuedFolderPathText(
  suggestion: FileSuggestion,
  context: FileAutocompleteContext,
) {
  return `${getFilePathParts(suggestion, context).join('/')}/`
}

function parseAutocompleteFileQuery(query: string): {
  pathKind: 'global' | 'relative'
  completedFolderPath: Array<string>
  fileQuery: string
} {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return {
      pathKind: 'global',
      completedFolderPath: [],
      fileQuery: '',
    }
  }

  const hasTrailingSlash = trimmedQuery.endsWith('/')
  const segments = trimmedQuery.split('/').map((segment) => segment.trim())
  const pathKind =
    segments[0] === '.' || segments[0] === '..' ? ('relative' as const) : ('global' as const)

  if (hasTrailingSlash) {
    return {
      pathKind,
      completedFolderPath: segments.slice(0, -1).filter(Boolean),
      fileQuery: '',
    }
  }

  return {
    pathKind,
    completedFolderPath: segments.slice(0, -1).filter(Boolean),
    fileQuery: segments.at(-1) ?? '',
  }
}

function getValueAutocompleteContextFromSource(
  query: string,
  itemSource: WikiLinkAutocompleteItemSource,
  sourceNoteId?: SidebarItemId,
): ValueAutocompleteContext | null {
  const dotIdx = query.lastIndexOf('.')
  if (dotIdx === -1) {
    return null
  }

  const notePathRaw = query.slice(0, dotIdx).trim()
  const valueQuery = query.slice(dotIdx + 1).trim()
  if (!notePathRaw) {
    return null
  }

  const resolvedItem = itemSource.resolveNotePath({
    text: notePathRaw,
    sourceItemId: sourceNoteId,
  })
  if (!resolvedItem || resolvedItem.type !== RESOURCE_TYPES.notes) {
    return null
  }

  return {
    mode: 'value',
    notePathRaw,
    valueQuery,
    resolvedItem,
  }
}

function getHeadingAutocompleteContextFromSource(
  query: string,
  hashIdx: number,
  itemSource: WikiLinkAutocompleteItemSource,
  sourceNoteId?: SidebarItemId,
): AutocompleteContext {
  const filePath = query.slice(0, hashIdx)
  const parsedFilePath = parseWikiLinkText(filePath)
  const filePathSegments = parsedFilePath.itemPath
  const item = itemSource.resolveItemPath({
    pathKind: parsedFilePath.pathKind,
    pathSegments: filePathSegments,
    sourceItemId: sourceNoteId,
  })

  if (!item || item.type !== RESOURCE_TYPES.notes) {
    const completedFolderPath = filePathSegments.slice(0, -1)
    return {
      mode: 'file',
      pathKind: parsedFilePath.pathKind,
      fileQuery: filePathSegments.at(-1) || '',
      completedFolderPath,
      resolvedParentId: itemSource.resolveFolderPath({
        pathKind: parsedFilePath.pathKind,
        pathSegments: completedFolderPath,
        sourceItemId: sourceNoteId,
      }),
    }
  }

  const parts = query.slice(hashIdx + 1).split('#')
  return {
    mode: 'heading',
    pathKind: parsedFilePath.pathKind,
    fileQuery: filePath,
    completedFolderPath: filePathSegments.slice(0, -1),
    headingQuery: parts.at(-1) || '',
    completedHeadingPath: parts.slice(0, -1),
    resolvedItem: item,
  }
}

function buildFileSuggestionsFromSource(
  itemSource: WikiLinkAutocompleteItemSource,
  context: FileAutocompleteContext,
): Array<FileSuggestion> {
  const itemsToShow =
    context.completedFolderPath.length === 0
      ? itemSource.queryItems()
      : context.resolvedParentId === undefined
        ? []
        : itemSource.queryItems({ parentId: context.resolvedParentId })

  const suggestions = itemsToShow.map((item) => ({
    kind: 'file' as const,
    key: item.id,
    title: item.name,
    subtext: itemSource.getItemBreadcrumbs(item),
    badge: getItemTypeLabel(item.type),
    item,
    linkPath: [...itemSource.getItemLinkPath(item)],
  }))
  return context.fileQuery ? filterSuggestionItems(suggestions, context.fileQuery) : suggestions
}

function getItemTypeLabel(type: ResourceKind): string {
  switch (type) {
    case RESOURCE_TYPES.notes:
      return 'Note'
    case RESOURCE_TYPES.folders:
      return 'Folder'
    case RESOURCE_TYPES.gameMaps:
      return 'Map'
    case RESOURCE_TYPES.files:
      return 'File'
    case RESOURCE_TYPES.canvases:
      return 'Canvas'
    default: {
      const exhaustive: never = type
      return exhaustive
    }
  }
}

function getChildHeadings(
  headings: Array<Heading>,
  parentLevel: number,
  startIdx: number,
): Array<Heading> {
  const children: Array<Heading> = []
  for (let i = startIdx; i < headings.length; i++) {
    if (headings[i].level <= parentLevel) break
    children.push(headings[i])
  }
  return children
}

function buildHeadingSuggestions(
  headings: Array<Heading>,
  completedPath: Array<string>,
  query: string,
): Array<HeadingSuggestion> {
  let remaining = headings

  for (const segment of completedPath) {
    const normalized = segment.toLowerCase().trim().replace(/\s+/g, ' ')
    if (!normalized) continue
    let idx = -1
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].normalizedText === normalized) {
        idx = i
        break
      }
    }
    if (idx === -1) return []
    remaining = getChildHeadings(remaining, remaining[idx].level, idx + 1)
  }

  const headingPaths = buildHeadingFullPaths(remaining)
  const suggestions = remaining.map((heading, idx) =>
    buildHeadingSuggestion(heading, headingPaths[idx]),
  )
  if (!query) return suggestions

  const q = query.toLowerCase()
  return suggestions.filter((suggestion) => suggestion.title.toLowerCase().includes(q))
}

function buildHeadingSuggestion(heading: Heading, fullPath: Array<string>): HeadingSuggestion {
  return {
    kind: 'heading',
    key: heading.noteBlockId,
    title: heading.text,
    level: heading.level,
    fullPath,
  }
}

function buildValueSuggestions(
  values: Array<NoteValueRuntimeState<SidebarItemId>>,
  query: string,
): Array<ValueSuggestion> {
  const suggestions = values.map((value) => ({
    kind: 'value' as const,
    key: value.valueId,
    title: value.slug,
    slug: value.slug,
    formattedValue: value.status === 'ok' ? value.formattedValue : value.errorMessage,
    value,
  }))
  return query ? filterSuggestionItems(suggestions, query) : suggestions
}

function buildHeadingFullPaths(headings: Array<Heading>) {
  const pathsByLevel: Array<Array<string>> = []
  return headings.map((heading) => {
    const parentPath = pathsByLevel[heading.level - 2] ?? []
    const path = [...parentPath, heading.text]
    pathsByLevel[heading.level - 1] = path
    pathsByLevel.length = heading.level
    return path
  })
}

function getFilePathParts(suggestion: FileSuggestion, context: FileAutocompleteContext) {
  return context.pathKind === 'relative' || context.completedFolderPath.length > 0
    ? [...context.completedFolderPath, suggestion.title]
    : suggestion.linkPath
}

function buildHeadingPath(completedHeadingPath: Array<string>, suggestion: HeadingSuggestion) {
  return [...completedHeadingPath, ...suggestion.fullPath].join('#')
}
