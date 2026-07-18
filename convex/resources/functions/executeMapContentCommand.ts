import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  CampaignMemberId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import { parseAuthoredDestination } from '@wizard-archive/editor/resources/authored-destination'
import type {
  MapContentCommand,
  MapResourceContent,
} from '@wizard-archive/editor/resources/content-session-contract'
import {
  assertVersionStamp,
  versionStampEquals,
} from '@wizard-archive/editor/resources/component-version'
import {
  advanceMapContentVersion,
  transitionMapContent,
} from '@wizard-archive/editor/resources/map-session-policy'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc } from '../../_generated/dataModel'
import { authorizeResourceContent } from './authorizeResourceContent'
import { jsonContentDigest } from './contentVersion'
import { findCanonicalResource } from './findCanonicalResource'
import type { projectMapContent } from './mapContent'
import { loadValidMapContentRows } from './mapContent'
import { replaceResourceReferenceProjection } from './resourceReferences'

const MAX_RECENT_MAP_OPERATIONS = 32

export type StoredMapContentCommand =
  | Readonly<{
      type: 'createPins'
      pins: ReadonlyArray<
        Readonly<{
          id: string
          destination: unknown
          layerId: string | null
          x: number
          y: number
        }>
      >
    }>
  | Readonly<{ type: 'movePin'; pinId: string; x: number; y: number }>
  | Readonly<{ type: 'setPinVisibility'; pinId: string; visible: boolean }>
  | Readonly<{ type: 'removePin'; pinId: string }>

type MapPinValue = Pick<
  Doc<'resourceMapPins'>,
  | 'campaignUuid'
  | 'destination'
  | 'layerId'
  | 'mapPinUuid'
  | 'mapResourceUuid'
  | 'visible'
  | 'x'
  | 'y'
>

type MapPinWrite =
  | Readonly<{ type: 'insert'; pin: MapPinValue }>
  | Readonly<{ type: 'patch'; id: Doc<'resourceMapPins'>['_id']; values: Partial<MapPinValue> }>
  | Readonly<{ type: 'delete'; id: Doc<'resourceMapPins'>['_id'] }>

export async function executeMapContentCommand(
  ctx: CampaignMutationCtx,
  args: Readonly<{
    resourceId: string
    operationId: string
    expectedVersion: unknown
    command: StoredMapContentCommand
  }>,
) {
  const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)
  const operationId = assertDomainId(DOMAIN_ID_KIND.operation, args.operationId)
  const loaded = await loadMapCommandState(ctx, resourceId)
  if (!loaded.ready) return loaded.result
  const { content, pins, projected: currentProjection } = loaded
  const fingerprint = await jsonContentDigest(args.command)
  const actorId = assertDomainId(DOMAIN_ID_KIND.campaignMember, ctx.membership.campaignMemberUuid)
  const replay = replayMapCommand(content, currentProjection, operationId, actorId, fingerprint)
  if (replay) return replay
  const currentVersion = assertVersionStamp(content.version)
  if (!versionStampEquals(currentVersion, assertVersionStamp(args.expectedVersion))) {
    return rejected('version_conflict')
  }
  const command = readMapContentCommand(args.command)
  if (!command) return rejected('invalid_command')
  const transition = transitionMapContent(resourceId, currentProjection, command)
  if (transition.status === 'rejected') return rejected(transition.reason)
  if (
    command.type === 'createPins' &&
    !(await mapTargetsExist(
      ctx,
      ctx.resourceScope.campaignId,
      command.pins.map((pin) => pin.destination),
    ))
  ) {
    return rejected('target_missing')
  }
  const advanced = await advanceMapCommand(transition.content, currentVersion)
  if (!advanced.completed) return advanced.result
  if (
    (
      await replaceResourceReferenceProjection(ctx, {
        campaignId: ctx.resourceScope.campaignId,
        sourceResourceId: resourceId,
        sourceVersion: advanced.version,
        destinations: transition.content.pins.map((pin) => pin.destination),
      })
    ).status !== 'completed'
  ) {
    return rejected('content_corrupt')
  }
  await applyMapPinWrites(
    ctx,
    mapPinWrites(ctx.resourceScope.campaignId, resourceId, pins, command),
  )
  await ctx.db.patch('resourceMapContents', content._id, {
    recentOperations: [
      ...content.recentOperations,
      { operationUuid: operationId, actorUuid: actorId, fingerprint },
    ].slice(-MAX_RECENT_MAP_OPERATIONS),
    version: advanced.version,
  })
  return {
    status: 'completed' as const,
    content: {
      image: transition.content.image,
      layers: transition.content.layers.map((layer) => ({ ...layer })),
      pins: transition.content.pins.map((pin) => ({ ...pin })),
    },
    version: advanced.version,
  }
}

async function loadMapCommandState(ctx: CampaignMutationCtx, resourceId: ResourceId) {
  const authorization = await authorizeResourceContent(ctx, resourceId, 'map', 'edit')
  if (authorization.status !== 'authorized') {
    return { ready: false as const, result: rejected('unauthorized') }
  }
  const rows = await loadValidMapContentRows(ctx.db, resourceId, ctx.resourceScope.campaignId)
  if (rows.status === 'missing') {
    return { ready: false as const, result: rejected('content_missing') }
  }
  if (rows.status === 'corrupt' || rows.content.state === 'failed') {
    return { ready: false as const, result: rejected('content_corrupt') }
  }
  if (rows.content.state === 'initializing') {
    return {
      ready: false as const,
      result: { status: 'retryable' as const, reason: 'content_initializing' as const },
    }
  }
  return { ready: true as const, ...rows }
}

function replayMapCommand(
  content: Doc<'resourceMapContents'>,
  projected: ReturnType<typeof projectMapContent>,
  operationId: OperationId,
  actorId: CampaignMemberId,
  fingerprint: string,
) {
  const replay = content.recentOperations.find(
    (operation) => operation.operationUuid === operationId,
  )
  if (!replay) return null
  return replay.actorUuid === actorId && replay.fingerprint === fingerprint
    ? { status: 'completed' as const, content: projected, version: content.version }
    : rejected('operation_id_reused')
}

async function advanceMapCommand(
  content: MapResourceContent,
  currentVersion: ReturnType<typeof assertVersionStamp>,
) {
  try {
    return {
      completed: true as const,
      version: await advanceMapContentVersion(currentVersion, content),
    }
  } catch (error) {
    return {
      completed: false as const,
      result: rejected(error instanceof RangeError ? 'version_exhausted' : 'content_corrupt'),
    }
  }
}

function readMapContentCommand(command: StoredMapContentCommand): MapContentCommand | null {
  try {
    switch (command.type) {
      case 'createPins': {
        const pins = command.pins.map((pin) => {
          const destination = parseAuthoredDestination(pin.destination)
          if (!destination) throw new TypeError('Invalid map destination')
          return {
            ...pin,
            id: assertDomainId(DOMAIN_ID_KIND.mapPin, pin.id),
            destination,
          }
        })
        return { type: 'createPins', pins }
      }
      case 'movePin':
        return {
          ...command,
          pinId: assertDomainId(DOMAIN_ID_KIND.mapPin, command.pinId),
        }
      case 'setPinVisibility':
        return {
          ...command,
          pinId: assertDomainId(DOMAIN_ID_KIND.mapPin, command.pinId),
        }
      case 'removePin':
        return {
          ...command,
          pinId: assertDomainId(DOMAIN_ID_KIND.mapPin, command.pinId),
        }
    }
  } catch {
    return null
  }
}

function mapPinWrites(
  campaignId: CampaignId,
  resourceId: ResourceId,
  pins: ReadonlyArray<Doc<'resourceMapPins'>>,
  command: MapContentCommand,
): ReadonlyArray<MapPinWrite> {
  switch (command.type) {
    case 'createPins':
      return command.pins.map((pin) => ({
        type: 'insert',
        pin: {
          campaignUuid: campaignId,
          mapResourceUuid: resourceId,
          mapPinUuid: pin.id,
          destination: pin.destination,
          layerId: pin.layerId,
          visible: true,
          x: pin.x,
          y: pin.y,
        },
      }))
    case 'movePin': {
      const pin = pins.find((candidate) => candidate.mapPinUuid === command.pinId)!
      return [{ type: 'patch', id: pin._id, values: { x: command.x, y: command.y } }]
    }
    case 'setPinVisibility': {
      const pin = pins.find((candidate) => candidate.mapPinUuid === command.pinId)!
      return [{ type: 'patch', id: pin._id, values: { visible: command.visible } }]
    }
    case 'removePin': {
      const pin = pins.find((candidate) => candidate.mapPinUuid === command.pinId)!
      return [{ type: 'delete', id: pin._id }]
    }
  }
}

async function mapTargetsExist(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  values: ReadonlyArray<
    Extract<MapContentCommand, { type: 'createPins' }>['pins'][number]['destination']
  >,
): Promise<boolean> {
  const resourceIds = Array.from(
    new Set(
      values.flatMap((destination) =>
        destination.kind === 'internal' ? [destination.target.resourceId] : [],
      ),
    ),
  )
  const resources = await Promise.all(
    resourceIds.map((resourceId) => findCanonicalResource(ctx.db, resourceId)),
  )
  return resources.every(
    (resource) => resource?.campaignUuid === campaignId && resource.lifecycle === 'active',
  )
}

async function applyMapPinWrites(
  ctx: CampaignMutationCtx,
  writes: ReadonlyArray<MapPinWrite>,
): Promise<void> {
  await Promise.all(
    writes.map((write) => {
      switch (write.type) {
        case 'insert':
          return ctx.db.insert('resourceMapPins', write.pin)
        case 'patch':
          return ctx.db.patch('resourceMapPins', write.id, write.values)
        case 'delete':
          return ctx.db.delete(write.id)
      }
    }),
  )
}

function rejected(
  reason:
    | 'content_corrupt'
    | 'content_missing'
    | 'invalid_command'
    | 'operation_id_reused'
    | 'pin_missing'
    | 'target_missing'
    | 'unauthorized'
    | 'version_conflict'
    | 'version_exhausted',
) {
  return { status: 'rejected' as const, reason }
}
