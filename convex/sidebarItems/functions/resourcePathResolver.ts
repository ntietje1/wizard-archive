import { normalizeLegacyResourcePathSegment } from '../resourcePathSegment'
import { RESOURCE_STATUS } from '@wizard-archive/editor/resources/items-persistence-contract'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import type { PermissionLevel } from '../../../shared/permissions/types'
import { canAccessResourceAndAncestors } from './resourceAccessPolicy'
import type { LinkPathKind } from '../../../shared/links/types'
import type { CampaignMemberRow } from '../../campaigns/rows'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'

type ResourcePathResolverCtx = Pick<MutationCtx, 'db'> & {
  campaign: Pick<Doc<'campaigns'>, '_id'>
  membership?: CampaignMemberRow
}

export interface AccessibleResourcePathResolver {
  getAccessibleItem: (itemId: Id<'sidebarItems'>) => Promise<Doc<'sidebarItems'> | null>
  resolvePath: (input: {
    pathKind: LinkPathKind
    pathSegments: ReadonlyArray<string>
    sourceParentId?: Id<'sidebarItems'> | null
  }) => Promise<Doc<'sidebarItems'> | null>
}

export function createAccessibleResourcePathResolver(
  ctx: ResourcePathResolverCtx,
): AccessibleResourcePathResolver {
  const itemCache = new Map<Id<'sidebarItems'>, Doc<'sidebarItems'> | null>()
  const candidateCache = new Map<string, Promise<Array<Doc<'sidebarItems'>>>>()
  const pathCache = new Map<Id<'sidebarItems'>, Promise<Array<string> | null>>()
  const accessibleItemCache = new Map<Id<'sidebarItems'>, Promise<Doc<'sidebarItems'> | null>>()
  const resolutionCache = new Map<string, Promise<Doc<'sidebarItems'> | null>>()
  const permissionCache = new Map<Id<'sidebarItems'>, Promise<PermissionLevel>>()

  const loadItem = async (itemId: Id<'sidebarItems'>) => {
    if (itemCache.has(itemId)) return itemCache.get(itemId) ?? null
    const item = await ctx.db.get('sidebarItems', itemId)
    itemCache.set(itemId, item)
    return item
  }

  const loadCandidates = (normalizedName: string) => {
    let candidates = candidateCache.get(normalizedName)
    if (!candidates) {
      candidates = ctx.db
        .query('sidebarItems')
        .withIndex('by_campaign_status_normalizedName_deletionTime', (q) =>
          q
            .eq('campaignId', ctx.campaign._id)
            .eq('status', RESOURCE_STATUS.active)
            .eq('normalizedName', normalizedName)
            .eq('deletionTime', null),
        )
        .collect()
        .then((items) => {
          for (const item of items) itemCache.set(item._id, item)
          return items
        })
      candidateCache.set(normalizedName, candidates)
    }
    return candidates
  }

  const loadNormalizedPath = (item: Doc<'sidebarItems'>) => {
    let path = pathCache.get(item._id)
    if (!path) {
      path = buildNormalizedPath(ctx.campaign._id, item, loadItem)
      pathCache.set(item._id, path)
    }
    return path
  }

  const getAccessibleItem = (itemId: Id<'sidebarItems'>) => {
    let accessibleItem = accessibleItemCache.get(itemId)
    if (!accessibleItem) {
      accessibleItem = (async () => {
        if (!ctx.membership) return null
        const item = await loadItem(itemId)
        if (
          !item ||
          item.campaignId !== ctx.campaign._id ||
          item.status !== RESOURCE_STATUS.active
        ) {
          return null
        }
        const canAccess = await canAccessResourceAndAncestors(
          { ...ctx, membership: ctx.membership },
          item,
          PERMISSION_LEVEL.VIEW,
          permissionCache,
        )
        return canAccess ? item : null
      })()
      accessibleItemCache.set(itemId, accessibleItem)
    }
    return accessibleItem
  }

  const resolvePath: AccessibleResourcePathResolver['resolvePath'] = (input) => {
    const normalizedSegments = input.pathSegments.map(normalizeLegacyResourcePathSegment)
    const cacheKey = JSON.stringify([
      input.pathKind,
      normalizedSegments,
      input.sourceParentId ?? null,
    ])
    let resolution = resolutionCache.get(cacheKey)
    if (!resolution) {
      resolution =
        input.pathKind === 'relative'
          ? resolveRelativePath({
              getAccessibleItem,
              loadCandidates,
              loadItem,
              normalizedSegments,
              sourceParentId: input.sourceParentId,
            })
          : resolveGlobalPath({
              getAccessibleItem,
              loadCandidates,
              loadNormalizedPath,
              normalizedSegments,
            })
      resolutionCache.set(cacheKey, resolution)
    }
    return resolution
  }

  return { getAccessibleItem, resolvePath }
}

async function buildNormalizedPath(
  campaignId: Id<'campaigns'>,
  item: Doc<'sidebarItems'>,
  loadItem: (itemId: Id<'sidebarItems'>) => Promise<Doc<'sidebarItems'> | null>,
): Promise<Array<string> | null> {
  const path: Array<string> = []
  const seen = new Set<Id<'sidebarItems'>>()
  let current: Doc<'sidebarItems'> | null = item
  while (current) {
    if (
      seen.has(current._id) ||
      current.campaignId !== campaignId ||
      current.status !== RESOURCE_STATUS.active
    ) {
      return null
    }
    seen.add(current._id)
    path.unshift(current.normalizedName)
    current = current.parentId ? await loadItem(current.parentId) : null
  }
  return path
}

async function resolveGlobalPath({
  getAccessibleItem,
  loadCandidates,
  loadNormalizedPath,
  normalizedSegments,
}: {
  getAccessibleItem: AccessibleResourcePathResolver['getAccessibleItem']
  loadCandidates: (normalizedName: string) => Promise<Array<Doc<'sidebarItems'>>>
  loadNormalizedPath: (item: Doc<'sidebarItems'>) => Promise<Array<string> | null>
  normalizedSegments: Array<string>
}) {
  const leaf = normalizedSegments[normalizedSegments.length - 1]
  if (!leaf || normalizedSegments.some((segment) => segment.length === 0)) return null

  const candidates = await loadCandidates(leaf)
  const matches = (
    await Promise.all(
      candidates.map(async (candidate) => {
        const [accessibleItem, path] = await Promise.all([
          getAccessibleItem(candidate._id),
          loadNormalizedPath(candidate),
        ])
        return accessibleItem && path && matchesPathSuffix(path, normalizedSegments)
          ? { item: accessibleItem, path }
          : null
      }),
    )
  ).filter((match): match is { item: Doc<'sidebarItems'>; path: Array<string> } => match !== null)
  matches.sort(comparePathMatches)
  return matches[0]?.item ?? null
}

async function resolveRelativePath({
  getAccessibleItem,
  loadCandidates,
  loadItem,
  normalizedSegments,
  sourceParentId,
}: {
  getAccessibleItem: AccessibleResourcePathResolver['getAccessibleItem']
  loadCandidates: (normalizedName: string) => Promise<Array<Doc<'sidebarItems'>>>
  loadItem: (itemId: Id<'sidebarItems'>) => Promise<Doc<'sidebarItems'> | null>
  normalizedSegments: Array<string>
  sourceParentId?: Id<'sidebarItems'> | null
}) {
  if (normalizedSegments.length === 0 || sourceParentId === undefined) return null

  let state: RelativePathState = { parentId: sourceParentId, item: null }
  for (const segment of normalizedSegments) {
    const nextState = await resolveRelativePathStep({
      loadCandidates,
      loadItem,
      segment,
      state,
    })
    if (!nextState) return null
    state = nextState
  }

  return state.item ? await getAccessibleItem(state.item._id) : null
}

type RelativePathState = {
  parentId: Id<'sidebarItems'> | null
  item: Doc<'sidebarItems'> | null
}

async function resolveRelativePathStep({
  loadCandidates,
  loadItem,
  segment,
  state,
}: {
  loadCandidates: (normalizedName: string) => Promise<Array<Doc<'sidebarItems'>>>
  loadItem: (itemId: Id<'sidebarItems'>) => Promise<Doc<'sidebarItems'> | null>
  segment: string
  state: RelativePathState
}): Promise<RelativePathState | null> {
  if (!segment) return null
  if (segment === '.') {
    return {
      parentId: state.parentId,
      item: state.parentId ? await loadItem(state.parentId) : null,
    }
  }
  if (segment === '..') return await resolveRelativeParent(state.parentId, loadItem)

  const candidates = await loadCandidates(segment)
  const item = candidates.find((candidate) => candidate.parentId === state.parentId) ?? null
  return item ? { parentId: item._id, item } : null
}

async function resolveRelativeParent(
  parentId: Id<'sidebarItems'> | null,
  loadItem: (itemId: Id<'sidebarItems'>) => Promise<Doc<'sidebarItems'> | null>,
): Promise<RelativePathState | null> {
  if (!parentId) return null
  const parent = await loadItem(parentId)
  if (!parent) return null
  const nextParentId = parent.parentId
  return {
    parentId: nextParentId,
    item: nextParentId ? await loadItem(nextParentId) : null,
  }
}

function matchesPathSuffix(path: Array<string>, suffix: Array<string>) {
  if (path.length < suffix.length) return false
  const startIndex = path.length - suffix.length
  return suffix.every((segment, index) => path[startIndex + index] === segment)
}

function comparePathMatches(left: { path: Array<string> }, right: { path: Array<string> }) {
  return (
    left.path.length - right.path.length || left.path.join('/').localeCompare(right.path.join('/'))
  )
}
