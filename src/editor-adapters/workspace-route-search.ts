import { DOMAIN_ID_KIND, parseDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CanvasNodeId,
  MapPinId,
  NoteBlockId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type { CanonicalTarget } from '@wizard-archive/editor/resources/authored-destination-contract'

export type WorkspaceRouteSearch =
  | {
      resource: ResourceId
      target?: never
      targetId?: never
      presentation?: never
      trash?: never
    }
  | {
      resource: ResourceId
      target: 'noteBlock'
      targetId: NoteBlockId
      presentation: 'block' | 'heading'
      trash?: never
    }
  | {
      resource: ResourceId
      target: 'mapPin'
      targetId: MapPinId
      presentation?: never
      trash?: never
    }
  | {
      resource: ResourceId
      target: 'canvasNode'
      targetId: CanvasNodeId
      presentation?: never
      trash?: never
    }
  | {
      trash: true
      resource?: never
      target?: never
      targetId?: never
      presentation?: never
    }
  | {
      resource?: never
      target?: never
      targetId?: never
      presentation?: never
      trash?: never
    }

export const validateSearch = (search: Record<string, unknown>): WorkspaceRouteSearch => {
  const requestedResource = nonEmptyString(search.resource)
  const resource = requestedResource
    ? parseDomainId(DOMAIN_ID_KIND.resource, requestedResource)
    : null
  const focusedTarget = {
    kind: nonEmptyString(search.target),
    id: nonEmptyString(search.targetId),
    presentation: nonEmptyString(search.presentation),
  }
  if (search.trash === true) {
    return requestedResource || hasFocusedTargetSearch(focusedTarget) ? {} : { trash: true }
  }
  if (!resource) return {}
  return validateResourceSearch(resource, focusedTarget)
}

function validateResourceSearch(
  resource: ResourceId,
  target: Readonly<{ kind: string | null; id: string | null; presentation: string | null }>,
): WorkspaceRouteSearch {
  if (!hasFocusedTargetSearch(target)) return { resource }
  switch (target.kind) {
    case 'noteBlock':
      return validateNoteBlockSearch(resource, target.id, target.presentation)
    case 'mapPin':
      return validateMapPinSearch(resource, target.id, target.presentation)
    case 'canvasNode':
      return validateCanvasNodeSearch(resource, target.id, target.presentation)
    default:
      return { resource }
  }
}

function validateNoteBlockSearch(
  resource: ResourceId,
  requestedId: string | null,
  presentation: string | null,
): WorkspaceRouteSearch {
  const targetId = requestedId ? parseDomainId(DOMAIN_ID_KIND.noteBlock, requestedId) : null
  return targetId && (presentation === 'block' || presentation === 'heading')
    ? { resource, target: 'noteBlock', targetId, presentation }
    : { resource }
}

function validateMapPinSearch(
  resource: ResourceId,
  requestedId: string | null,
  presentation: string | null,
): WorkspaceRouteSearch {
  const targetId = requestedId ? parseDomainId(DOMAIN_ID_KIND.mapPin, requestedId) : null
  return targetId && !presentation ? { resource, target: 'mapPin', targetId } : { resource }
}

function validateCanvasNodeSearch(
  resource: ResourceId,
  requestedId: string | null,
  presentation: string | null,
): WorkspaceRouteSearch {
  const targetId = requestedId ? parseDomainId(DOMAIN_ID_KIND.canvasNode, requestedId) : null
  return targetId && !presentation ? { resource, target: 'canvasNode', targetId } : { resource }
}

export function parseWorkspaceRouteSearchParams(
  searchParams: URLSearchParams,
): WorkspaceRouteSearch {
  return validateSearch({
    resource: searchParams.get('resource') ?? undefined,
    target: searchParams.get('target') ?? undefined,
    targetId: searchParams.get('targetId') ?? undefined,
    presentation: searchParams.get('presentation') ?? undefined,
    trash: searchParams.get('trash') === 'true',
  })
}

export function workspaceRouteSearchForTarget(target: CanonicalTarget): WorkspaceRouteSearch {
  switch (target.kind) {
    case 'resource':
      return { resource: target.resourceId }
    case 'noteBlock':
      return {
        resource: target.resourceId,
        target: target.kind,
        targetId: target.blockId,
        presentation: target.presentation,
      }
    case 'mapPin':
      return { resource: target.resourceId, target: target.kind, targetId: target.pinId }
    case 'canvasNode':
      return { resource: target.resourceId, target: target.kind, targetId: target.nodeId }
  }
}

export function workspaceRouteTarget(search: WorkspaceRouteSearch): CanonicalTarget | null {
  if (!search.resource) return null
  switch (search.target) {
    case undefined:
      return { kind: 'resource', resourceId: search.resource }
    case 'noteBlock':
      return {
        kind: search.target,
        resourceId: search.resource,
        blockId: search.targetId,
        presentation: search.presentation,
      }
    case 'mapPin':
      return { kind: search.target, resourceId: search.resource, pinId: search.targetId }
    case 'canvasNode':
      return { kind: search.target, resourceId: search.resource, nodeId: search.targetId }
  }
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function hasFocusedTargetSearch(
  target: Readonly<{ kind: string | null; id: string | null; presentation: string | null }>,
) {
  return target.kind !== null || target.id !== null || target.presentation !== null
}
