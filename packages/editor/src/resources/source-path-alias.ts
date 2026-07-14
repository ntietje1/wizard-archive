import { isUuidV7 } from './domain-id'
import type { CampaignId, ImportJobId, ResourceId } from './domain-id'
import type { SourcePathAlias } from './resource-catalog-contract'
import { hasUnpairedUtf16 } from './well-formed-unicode'

export type SourcePathAliasResolution =
  | Readonly<{ status: 'resolved'; resourceId: ResourceId }>
  | Readonly<{ status: 'missing' }>
  | Readonly<{ status: 'ambiguous'; resourceIds: ReadonlyArray<ResourceId> }>

export function normalizeSourcePath(rawPath: string): string {
  if (hasUnpairedUtf16(rawPath)) throw new TypeError('Source path contains malformed Unicode')
  const slashPath = rawPath.replaceAll('\\', '/')
  if (slashPath.startsWith('/') || /^[a-z]:/i.test(slashPath)) {
    throw new TypeError('Source path must be relative')
  }

  const rawSegments = slashPath.split('/')
  if (rawSegments.some((segment) => segment.length === 0)) {
    throw new TypeError('Source path contains an empty segment')
  }
  const normalizedSegments: Array<string> = []
  for (const segment of rawSegments) {
    if (segment === '..') throw new TypeError('Source path cannot traverse its source root')
    if (segment === '.') continue
    normalizedSegments.push(segment.normalize('NFC'))
  }
  if (normalizedSegments.length === 0) throw new TypeError('Source path must identify an entry')
  return normalizedSegments.join('/')
}

export function createSourcePathAlias({
  campaignId,
  importJobId,
  rawPath,
  resourceId,
  sourceRootId,
}: Readonly<{
  campaignId: CampaignId
  importJobId: ImportJobId
  rawPath: string
  resourceId: ResourceId
  sourceRootId: string
}>): SourcePathAlias {
  const alias = {
    campaignId,
    resourceId,
    importJobId,
    sourceRootId,
    rawPath,
    normalizedPath: normalizeSourcePath(rawPath),
  }
  assertSourcePathAlias(alias)
  return alias
}

export function assertSourcePathAlias(alias: SourcePathAlias): void {
  if (!isUuidV7(alias.campaignId) || !isUuidV7(alias.resourceId) || !isUuidV7(alias.importJobId)) {
    throw new TypeError('Source path alias requires canonical domain identities')
  }
  if (alias.sourceRootId.length === 0) throw new TypeError('Source root identity cannot be empty')
  if (normalizeSourcePath(alias.rawPath) !== alias.normalizedPath) {
    throw new TypeError('Source path alias is not canonically normalized')
  }
}

export function resolveSourcePathAlias(
  aliases: ReadonlyArray<SourcePathAlias>,
  {
    importJobId,
    rawPath,
    sourceRootId,
  }: Readonly<{ importJobId: ImportJobId; rawPath: string; sourceRootId: string }>,
): SourcePathAliasResolution {
  const normalizedPath = normalizeSourcePath(rawPath)
  const candidates = aliases.filter(
    (alias) => alias.importJobId === importJobId && alias.sourceRootId === sourceRootId,
  )

  const exact = resolutionFor(candidates.filter((alias) => alias.normalizedPath === normalizedPath))
  if (exact.status !== 'missing') return exact

  const basename = sourcePathBasename(normalizedPath)
  const byBasename = resolutionFor(
    candidates.filter((alias) => sourcePathBasename(alias.normalizedPath) === basename),
  )
  if (byBasename.status !== 'missing') return byBasename

  const stem = sourcePathStem(basename)
  return resolutionFor(
    candidates.filter((alias) => sourcePathStem(sourcePathBasename(alias.normalizedPath)) === stem),
  )
}

function resolutionFor(aliases: ReadonlyArray<SourcePathAlias>): SourcePathAliasResolution {
  const resourceIds = Array.from(new Set(aliases.map((alias) => alias.resourceId))).sort()
  if (resourceIds.length === 0) return { status: 'missing' }
  if (resourceIds.length === 1) return { status: 'resolved', resourceId: resourceIds[0]! }
  return { status: 'ambiguous', resourceIds }
}

function sourcePathBasename(normalizedPath: string): string {
  return normalizedPath.slice(normalizedPath.lastIndexOf('/') + 1)
}

function sourcePathStem(basename: string): string {
  const extensionStart = basename.lastIndexOf('.')
  return extensionStart <= 0 ? basename : basename.slice(0, extensionStart)
}
