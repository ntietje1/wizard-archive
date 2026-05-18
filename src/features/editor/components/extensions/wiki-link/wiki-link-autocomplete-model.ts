import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { parseWikiLinkText } from 'convex/links/linkParsers'
import {
  getMinDisambiguationPath,
  resolveParsedItemPath,
  resolveItemByPath,
} from 'convex/links/linkResolution'
import type { Heading, HeadingLevel } from 'convex/blocks/types'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { buildBreadcrumbs, getItemTypeLabel } from '~/features/sidebar/utils/sidebar-item-utils'
import { filterSuggestionItems } from '~/features/editor/utils/filter-suggestion-items'

const SUGGESTION_LIMIT = 10

export interface FileSuggestion {
  kind: 'file'
  key: Id<'sidebarItems'>
  title: string
  subtext: string
  badge: string
  item: AnySidebarItem
  linkPath: Array<string>
}

export interface HeadingSuggestion {
  kind: 'heading'
  key: string
  title: string
  level: HeadingLevel
  fullPath: Array<string>
}

interface DisplayNameAutocompleteContext {
  mode: 'display-name'
}

export interface FileAutocompleteContext {
  mode: 'file'
  pathKind: 'global' | 'relative'
  fileQuery: string
  completedFolderPath: Array<string>
  resolvedParentId: Id<'sidebarItems'> | null | undefined
}

export interface HeadingAutocompleteContext {
  mode: 'heading'
  pathKind: 'global' | 'relative'
  fileQuery: string
  completedFolderPath: Array<string>
  headingQuery: string
  completedHeadingPath: Array<string>
  resolvedItem: AnySidebarItem
}

export type AutocompleteContext =
  | DisplayNameAutocompleteContext
  | FileAutocompleteContext
  | HeadingAutocompleteContext

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

type WikiLinkAutocompleteModel = EmptyAutocompleteModel | ActiveAutocompleteModel

export function getWikiLinkAutocompleteContext(
  query: string,
  allItems: Array<AnySidebarItem>,
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>,
  sourceParentId: Id<'sidebarItems'> | null | undefined,
): AutocompleteContext {
  if (query.includes('|')) {
    return {
      mode: 'display-name',
    }
  }

  const hashIdx = query.indexOf('#')
  if (hashIdx === -1) {
    const { pathKind, completedFolderPath, fileQuery } = parseAutocompleteFileQuery(query)
    return {
      mode: 'file',
      pathKind,
      fileQuery,
      completedFolderPath,
      resolvedParentId: resolveCompletedFolderPath(
        pathKind,
        completedFolderPath,
        sourceParentId,
        allItems,
        itemsMap,
      ),
    }
  }

  return getHeadingAutocompleteContext(query, hashIdx, allItems, itemsMap, sourceParentId)
}

export function buildWikiLinkAutocompleteModel({
  context,
  sidebarItems,
  itemsMap,
  headings,
}: {
  context: AutocompleteContext | null
  sidebarItems: Array<AnySidebarItem>
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>
  headings: Array<Heading>
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

  const suggestions = buildFileSuggestions(sidebarItems, itemsMap, context)
  return {
    mode: 'file',
    context,
    suggestions: suggestions.slice(0, SUGGESTION_LIMIT),
    totalCount: suggestions.length,
  }
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
  return [...context.completedFolderPath, suggestion.title].join('/')
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

function resolveCompletedFolderPath(
  pathKind: 'global' | 'relative',
  completedFolderPath: Array<string>,
  sourceParentId: Id<'sidebarItems'> | null | undefined,
  allItems: Array<AnySidebarItem>,
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>,
): Id<'sidebarItems'> | null | undefined {
  if (completedFolderPath.length === 0) {
    return pathKind === 'relative' ? sourceParentId : null
  }

  if (pathKind === 'global') {
    return resolveItemByPath(completedFolderPath, allItems, itemsMap)?._id
  }

  if (sourceParentId === undefined) return undefined

  let currentParentId = sourceParentId
  for (const segment of completedFolderPath) {
    const nextParentId = resolveRelativeFolderSegment(segment, currentParentId, allItems, itemsMap)
    if (nextParentId === undefined) return undefined
    currentParentId = nextParentId
  }

  return currentParentId
}

function resolveRelativeFolderSegment(
  segment: string,
  currentParentId: Id<'sidebarItems'> | null,
  allItems: Array<AnySidebarItem>,
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>,
) {
  const normalizedSegment = segment.trim().toLowerCase()
  if (!normalizedSegment) return undefined
  if (normalizedSegment === '.') return currentParentId
  if (normalizedSegment === '..') {
    return currentParentId === null ? undefined : itemsMap.get(currentParentId)?.parentId
  }

  return allItems.find((item) => {
    return (
      item.parentId === currentParentId &&
      item.type === SIDEBAR_ITEM_TYPES.folders &&
      item.name.trim().toLowerCase() === normalizedSegment
    )
  })?._id
}

function getHeadingAutocompleteContext(
  query: string,
  hashIdx: number,
  allItems: Array<AnySidebarItem>,
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>,
  sourceParentId: Id<'sidebarItems'> | null | undefined,
): AutocompleteContext {
  const filePath = query.slice(0, hashIdx)
  const parsedFilePath = parseWikiLinkText(filePath)
  const filePathSegments = parsedFilePath.itemPath
  const item = resolveParsedItemPath(
    parsedFilePath.pathKind,
    filePathSegments,
    allItems,
    itemsMap,
    sourceParentId,
  )

  if (!item || item.type !== SIDEBAR_ITEM_TYPES.notes) {
    const completedFolderPath = filePathSegments.slice(0, -1)
    return {
      mode: 'file',
      pathKind: parsedFilePath.pathKind,
      fileQuery: filePathSegments.at(-1) || '',
      completedFolderPath,
      resolvedParentId: resolveCompletedFolderPath(
        parsedFilePath.pathKind,
        completedFolderPath,
        sourceParentId,
        allItems,
        itemsMap,
      ),
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

function buildFileSuggestions(
  sidebarItems: Array<AnySidebarItem>,
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>,
  context: FileAutocompleteContext,
): Array<FileSuggestion> {
  const itemsToShow =
    context.completedFolderPath.length === 0
      ? sidebarItems
      : context.resolvedParentId === undefined
        ? []
        : sidebarItems.filter((item) => item.parentId === context.resolvedParentId)

  const suggestions = itemsToShow.map((item) => ({
    kind: 'file' as const,
    key: item._id,
    title: item.name,
    subtext: buildBreadcrumbs(item, itemsMap),
    badge: getItemTypeLabel(item.type),
    item,
    linkPath: getMinDisambiguationPath(item, sidebarItems, itemsMap),
  }))
  return context.fileQuery ? filterSuggestionItems(suggestions, context.fileQuery) : suggestions
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
    const idx = remaining.findIndex((h) => h.normalizedText === normalized)
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
    key: heading.blockNoteId,
    title: heading.text,
    level: heading.level,
    fullPath,
  }
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
