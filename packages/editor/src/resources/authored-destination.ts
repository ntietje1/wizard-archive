import { isUuidV7 } from './domain-id'
import type { CampaignId, ResourceId } from './domain-id'
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
    case 'externalUrl': {
      const url = parseSafeHttpsUrl(authored.url)
      return url === null ? { status: 'unsupported' } : { status: 'external', url }
    }
    case 'unresolved':
      return { status: 'unresolved', rawTarget: authored.rawTarget }
    case 'internal': {
      const knowledge = await lookup(authored.target)
      switch (knowledge.state) {
        case 'missing':
          return {
            status: 'broken',
            kind: 'internal',
            target: authored.target,
            reason: 'missing',
          }
        case 'unavailable':
          return { status: 'unavailable', kind: 'internal', target: authored.target }
        case 'available':
          return knowledge.campaignId === campaignId
            ? {
                status: 'available',
                kind: 'internal',
                target: authored.target,
                display: knowledge.display,
              }
            : {
                status: 'broken',
                kind: 'internal',
                target: authored.target,
                reason: 'cross_campaign',
              }
      }
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
  const targets = new Map<string, CanonicalTarget>()
  for (const destination of destinations) {
    if (destination.kind === 'internal') {
      targets.set(canonicalTargetKey(destination.target), destination.target)
    }
  }
  return Array.from(targets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, target]) => ({ sourceResourceId, sourceVersion, target }))
}

export function backlinksForResource(
  edges: ReadonlyArray<ReferenceGraphEdge>,
  resourceId: ResourceId,
): ReadonlyArray<ReferenceGraphEdge> {
  return edges.filter((edge) => edge.target.resourceId === resourceId)
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

function canonicalTargetKey(target: CanonicalTarget): string {
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
