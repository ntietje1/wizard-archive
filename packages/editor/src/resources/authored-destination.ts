import { DOMAIN_ID_KIND, assertDomainId, isUuidV7 } from './domain-id'
import type { CampaignId, NoteBlockId, ResourceId } from './domain-id'
import type {
  AuthoredDestination,
  CanonicalTarget,
  SafeHttpsUrl,
} from './authored-destination-contract'
import { parseSafeHttpsUrl } from './authored-destination-contract'
import type { VersionStamp } from './component-version'
import type { CanonicalTargetMapEntry } from './content-copy-contract'
import type { SourcePathAlias } from './resource-catalog-contract'
import { resolveSourcePathAlias } from './source-path-alias'
import { hasUnpairedUtf16 } from './well-formed-unicode'

export type CanonicalTargetKnowledge<TDisplay> =
  | Readonly<{ state: 'available'; campaignId: CampaignId; display: TDisplay }>
  | Readonly<{ state: 'missing' }>
  | Readonly<{ state: 'unavailable' }>

export type ResolvedAuthoredDestination<TDisplay> =
  | Readonly<{
      status: 'available'
      kind: 'internal'
      target: CanonicalTarget
      display: TDisplay
    }>
  | Readonly<{
      status: 'broken'
      kind: 'internal'
      target: CanonicalTarget
      reason: 'missing' | 'cross_campaign'
    }>
  | Readonly<{ status: 'unavailable'; kind: 'internal'; target: CanonicalTarget }>
  | Readonly<{ status: 'external'; url: SafeHttpsUrl }>
  | Readonly<{ status: 'unresolved'; rawTarget: string }>
  | Readonly<{ status: 'unsupported' }>

export type SourceAuthoredDestinationResult =
  | Readonly<{ status: 'authored'; destination: AuthoredDestination }>
  | Readonly<{ status: 'ambiguous'; resourceIds: ReadonlyArray<ResourceId> }>

export type AuthoredDestinationRemapResult =
  | Readonly<{ status: 'completed'; destination: AuthoredDestination }>
  | Readonly<{ status: 'unmapped'; target: CanonicalTarget }>

export type ReferenceGraphEdge = Readonly<{
  sourceResourceId: ResourceId
  sourceVersion: VersionStamp
  target: CanonicalTarget
}>

export type ReferenceSourceOccurrence =
  | Readonly<{ kind: 'resource' }>
  | Readonly<{ kind: 'noteBlock'; blockId: NoteBlockId }>

export type AuthoredDestinationOccurrence = Readonly<{
  source: ReferenceSourceOccurrence
  destination: AuthoredDestination
}>

export type ReferenceGraphOccurrence = ReferenceGraphEdge &
  Readonly<{
    source: ReferenceSourceOccurrence
  }>

export const MAX_RESOURCE_REFERENCE_OCCURRENCES = 500

export const EMPTY_AUTHORED_DESTINATION_SERIALIZED = serializeAuthoredDestination({
  kind: 'unresolved',
  rawTarget: '',
})

export function serializeAuthoredDestination(destination: AuthoredDestination): string {
  switch (destination.kind) {
    case 'externalUrl':
      return JSON.stringify({ kind: destination.kind, url: destination.url })
    case 'unresolved':
      return JSON.stringify({ kind: destination.kind, rawTarget: destination.rawTarget })
    case 'internal':
      return JSON.stringify({
        kind: destination.kind,
        target: serializedTarget(destination.target),
      })
  }
}

export function parseSerializedAuthoredDestination(value: string): AuthoredDestination | null {
  try {
    const destination = parseAuthoredDestination(JSON.parse(value))
    return destination !== null && serializeAuthoredDestination(destination) === value
      ? destination
      : null
  } catch {
    return null
  }
}

function serializedTarget(target: CanonicalTarget): CanonicalTarget {
  switch (target.kind) {
    case 'resource':
      return { kind: target.kind, resourceId: target.resourceId }
    case 'noteBlock':
      return {
        kind: target.kind,
        resourceId: target.resourceId,
        blockId: target.blockId,
        presentation: target.presentation,
      }
    case 'mapPin':
      return { kind: target.kind, resourceId: target.resourceId, pinId: target.pinId }
    case 'canvasNode':
      return { kind: target.kind, resourceId: target.resourceId, nodeId: target.nodeId }
  }
}

export async function resolveAuthoredDestination<TDisplay>(
  destination: unknown,
  {
    campaignId,
    lookup,
  }: Readonly<{
    campaignId: CampaignId
    lookup: (
      target: CanonicalTarget,
    ) => CanonicalTargetKnowledge<TDisplay> | Promise<CanonicalTargetKnowledge<TDisplay>>
  }>,
): Promise<ResolvedAuthoredDestination<TDisplay>> {
  const authored = parseAuthoredDestination(destination)
  if (authored === null) return { status: 'unsupported' }
  switch (authored.kind) {
    case 'externalUrl':
    case 'unresolved':
      return resolveAuthoredDestinationKnowledge(authored, campaignId)
    case 'internal': {
      const knowledge = await lookup(authored.target)
      return resolveAuthoredDestinationKnowledge(authored, campaignId, knowledge)
    }
  }
}

export function resolveAuthoredDestinationKnowledge<TDisplay>(
  destination: AuthoredDestination,
  campaignId: CampaignId,
  knowledge?: CanonicalTargetKnowledge<TDisplay>,
): ResolvedAuthoredDestination<TDisplay> {
  switch (destination.kind) {
    case 'externalUrl': {
      const url = parseSafeHttpsUrl(destination.url)
      return url === null ? { status: 'unsupported' } : { status: 'external', url }
    }
    case 'unresolved':
      return { status: 'unresolved', rawTarget: destination.rawTarget }
    case 'internal':
      if (!knowledge || knowledge.state === 'unavailable') {
        return { status: 'unavailable', kind: 'internal', target: destination.target }
      }
      if (knowledge.state === 'missing') {
        return {
          status: 'broken',
          kind: 'internal',
          target: destination.target,
          reason: 'missing',
        }
      }
      return knowledge.campaignId === campaignId
        ? {
            status: 'available',
            kind: 'internal',
            target: destination.target,
            display: knowledge.display,
          }
        : {
            status: 'broken',
            kind: 'internal',
            target: destination.target,
            reason: 'cross_campaign',
          }
  }
}

export function resolveSourceAuthoredDestination(
  aliases: ReadonlyArray<SourcePathAlias>,
  {
    importJobId,
    rawTarget,
    sourceRootId,
  }: Readonly<{
    importJobId: SourcePathAlias['importJobId']
    rawTarget: string
    sourceRootId: string
  }>,
): SourceAuthoredDestinationResult {
  const resolution = resolveSourcePathAlias(aliases, {
    importJobId,
    rawPath: rawTarget,
    sourceRootId,
  })
  switch (resolution.status) {
    case 'resolved':
      return {
        status: 'authored',
        destination: {
          kind: 'internal',
          target: { kind: 'resource', resourceId: resolution.resourceId },
        },
      }
    case 'missing':
      return {
        status: 'authored',
        destination: { kind: 'unresolved', rawTarget },
      }
    case 'ambiguous':
      return { status: 'ambiguous', resourceIds: resolution.resourceIds }
  }
}

export function remapAuthoredDestination(
  destination: AuthoredDestination,
  targetMap: ReadonlyArray<CanonicalTargetMapEntry>,
  mode: 'same_campaign_copy' | 'same_campaign_update' | 'new_campaign_clone',
): AuthoredDestinationRemapResult {
  if (destination.kind !== 'internal' || mode === 'same_campaign_update') {
    return { status: 'completed', destination }
  }
  const mapping = targetMap.find((entry) => canonicalTargetsEqual(entry.source, destination.target))
  if (mapping) {
    return {
      status: 'completed',
      destination: { kind: 'internal', target: mapping.destination },
    }
  }
  return mode === 'same_campaign_copy'
    ? { status: 'completed', destination }
    : { status: 'unmapped', target: destination.target }
}

export function projectReferenceGraph(
  sourceResourceId: ResourceId,
  sourceVersion: VersionStamp,
  destinations: ReadonlyArray<AuthoredDestination>,
): ReadonlyArray<ReferenceGraphEdge> {
  const occurrences = projectReferenceOccurrences(
    sourceResourceId,
    sourceVersion,
    resourceAuthoredDestinationOccurrences(destinations),
  )
  const targets = new Map<string, CanonicalTarget>()
  for (const occurrence of occurrences) {
    targets.set(canonicalTargetKey(occurrence.target), occurrence.target)
  }
  return Array.from(targets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, target]) => ({ sourceResourceId, sourceVersion, target }))
}

export function resourceAuthoredDestinationOccurrences(
  destinations: ReadonlyArray<AuthoredDestination>,
): ReadonlyArray<AuthoredDestinationOccurrence> {
  return destinations.map((destination) => ({ source: { kind: 'resource' }, destination }))
}

export function projectReferenceOccurrences(
  sourceResourceId: ResourceId,
  sourceVersion: VersionStamp,
  occurrences: ReadonlyArray<AuthoredDestinationOccurrence>,
): ReadonlyArray<ReferenceGraphOccurrence> {
  const projected = new Map<string, ReferenceGraphOccurrence>()
  for (const occurrence of occurrences) {
    if (occurrence.destination.kind !== 'internal') continue
    const key = referenceOccurrenceKey(occurrence.source, occurrence.destination.target)
    projected.set(key, {
      sourceResourceId,
      sourceVersion,
      source: occurrence.source,
      target: occurrence.destination.target,
    })
  }
  if (projected.size > MAX_RESOURCE_REFERENCE_OCCURRENCES) {
    throw new RangeError('Resource reference projection exceeds its bound')
  }
  return Array.from(projected.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, occurrence]) => occurrence)
}

export function projectReferenceEdges(
  occurrences: ReadonlyArray<ReferenceGraphOccurrence>,
  direction: 'outgoing' | 'backlinks',
): ReadonlyArray<ReferenceGraphEdge> {
  const edges = new Map<string, ReferenceGraphEdge>()
  for (const occurrence of occurrences) {
    const key =
      direction === 'outgoing'
        ? canonicalTargetKey(occurrence.target)
        : `${occurrence.sourceResourceId}:${canonicalTargetKey(occurrence.target)}`
    edges.set(key, {
      sourceResourceId: occurrence.sourceResourceId,
      sourceVersion: occurrence.sourceVersion,
      target: occurrence.target,
    })
  }
  return Array.from(edges.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, edge]) => edge)
}

export function referenceOccurrenceKey(
  source: ReferenceSourceOccurrence,
  target: CanonicalTarget,
): string {
  const sourceKey = source.kind === 'resource' ? 'resource' : `noteBlock:${source.blockId}`
  return `${sourceKey}:${canonicalTargetKey(target)}`
}

export function parseReferenceSourceOccurrence(value: unknown): ReferenceSourceOccurrence | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null
  if (value.kind === 'resource' && hasOnlyKeys(value, ['kind'])) return { kind: 'resource' }
  if (
    value.kind === 'noteBlock' &&
    hasOnlyKeys(value, ['kind', 'blockId']) &&
    typeof value.blockId === 'string' &&
    isUuidV7(value.blockId)
  ) {
    return {
      kind: 'noteBlock',
      blockId: assertDomainId(DOMAIN_ID_KIND.noteBlock, value.blockId),
    }
  }
  return null
}

export function parseAuthoredDestination(value: unknown): AuthoredDestination | null {
  if (!isRecord(value) || typeof value.kind !== 'string') return null
  switch (value.kind) {
    case 'externalUrl': {
      if (!hasOnlyKeys(value, ['kind', 'url']) || typeof value.url !== 'string') return null
      const url = parseSafeHttpsUrl(value.url)
      return url === null ? null : { kind: 'externalUrl', url }
    }
    case 'unresolved': {
      return hasOnlyKeys(value, ['kind', 'rawTarget']) &&
        typeof value.rawTarget === 'string' &&
        !hasUnpairedUtf16(value.rawTarget)
        ? { kind: 'unresolved', rawTarget: value.rawTarget }
        : null
    }
    case 'internal':
      return hasOnlyKeys(value, ['kind', 'target']) && isCanonicalTarget(value.target)
        ? { kind: 'internal', target: value.target }
        : null
    default:
      return null
  }
}

function isCanonicalTarget(value: unknown): value is CanonicalTarget {
  if (!isRecord(value) || typeof value.kind !== 'string' || !isUuidV7Value(value.resourceId)) {
    return false
  }
  switch (value.kind) {
    case 'resource':
      return hasOnlyKeys(value, ['kind', 'resourceId'])
    case 'noteBlock':
      return (
        hasOnlyKeys(value, ['kind', 'resourceId', 'blockId', 'presentation']) &&
        isUuidV7Value(value.blockId) &&
        (value.presentation === 'block' || value.presentation === 'heading')
      )
    case 'mapPin':
      return hasOnlyKeys(value, ['kind', 'resourceId', 'pinId']) && isUuidV7Value(value.pinId)
    case 'canvasNode':
      return hasOnlyKeys(value, ['kind', 'resourceId', 'nodeId']) && isUuidV7Value(value.nodeId)
    default:
      return false
  }
}

export function canonicalTargetsEqual(left: CanonicalTarget, right: CanonicalTarget): boolean {
  return canonicalTargetKey(left) === canonicalTargetKey(right)
}

export function canonicalTargetKey(target: CanonicalTarget): string {
  switch (target.kind) {
    case 'resource':
      return `resource:${target.resourceId}`
    case 'noteBlock':
      return `noteBlock:${target.resourceId}:${target.blockId}:${target.presentation}`
    case 'mapPin':
      return `mapPin:${target.resourceId}:${target.pinId}`
    case 'canvasNode':
      return `canvasNode:${target.resourceId}:${target.nodeId}`
  }
}

function isUuidV7Value(value: unknown): value is string {
  return typeof value === 'string' && isUuidV7(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasOnlyKeys(value: Record<string, unknown>, keys: ReadonlyArray<string>): boolean {
  const actual = Object.keys(value)
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}
