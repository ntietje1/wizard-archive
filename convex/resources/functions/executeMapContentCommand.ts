import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  CampaignMemberId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import { isMapPosition } from '@wizard-archive/editor/resources/content-session-contract'
import {
  parseAuthoredDestination,
  serializeAuthoredDestination,
} from '@wizard-archive/editor/resources/authored-destination'
import {
  advanceVersion,
  assertVersionStamp,
  versionStampEquals,
} from '@wizard-archive/editor/resources/component-version'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc } from '../../_generated/dataModel'
import { authorizeResourceContent } from './authorizeResourceContent'
import { jsonContentDigest } from './contentVersion'
import { findCanonicalResource } from './findCanonicalResource'
import { loadValidMapContentRows, projectMapContent } from './mapContent'

const MAX_MAP_PINS = 500
const MAX_MAP_PINS_PER_COMMAND = 100
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

type MapCommandPlan = Readonly<{
  pins: ReadonlyArray<MapPinValue>
  writes: ReadonlyArray<MapPinWrite>
}>

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
  const plan = await planMapCommand(
    ctx,
    ctx.resourceScope.campaignId,
    resourceId,
    content.layers.map((layer) => layer.id),
    pins,
    args.command,
  )
  if ('status' in plan) return plan
  const advanced = await advanceMapCommand(content, plan.pins, currentVersion)
  if (!advanced.completed) return advanced.result
  await applyMapPinWrites(ctx, plan.writes)
  await ctx.db.patch('resourceMapContents', content._id, {
    recentOperations: [
      ...content.recentOperations,
      { operationUuid: operationId, actorUuid: actorId, fingerprint },
    ].slice(-MAX_RECENT_MAP_OPERATIONS),
    version: advanced.version,
  })
  return { status: 'completed' as const, content: advanced.projected, version: advanced.version }
}

async function loadMapCommandState(ctx: CampaignMutationCtx, resourceId: ResourceId) {
  const authorization = await authorizeResourceContent(ctx, resourceId, 'map')
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
  content: Doc<'resourceMapContents'>,
  pins: ReadonlyArray<MapPinValue>,
  currentVersion: ReturnType<typeof assertVersionStamp>,
) {
  try {
    const projected = projectMapContent(content, pins)
    return {
      completed: true as const,
      projected,
      version: advanceVersion(currentVersion, await jsonContentDigest(projected)),
    }
  } catch (error) {
    return {
      completed: false as const,
      result: rejected(error instanceof RangeError ? 'version_exhausted' : 'content_corrupt'),
    }
  }
}

async function planMapCommand(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  resourceId: ResourceId,
  layerIds: ReadonlyArray<string>,
  pins: ReadonlyArray<Doc<'resourceMapPins'>>,
  command: StoredMapContentCommand,
): Promise<MapCommandPlan | ReturnType<typeof rejected>> {
  switch (command.type) {
    case 'createPins':
      return await planMapPinCreations(ctx, campaignId, resourceId, layerIds, pins, command.pins)
    case 'movePin':
      return planMapPinMove(pins, command.pinId, command)
    case 'setPinVisibility':
      return planMapPinVisibility(pins, command.pinId, command.visible)
    case 'removePin':
      return planMapPinRemoval(pins, command.pinId)
  }
}

async function planMapPinCreations(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  resourceId: ResourceId,
  layerIds: ReadonlyArray<string>,
  pins: ReadonlyArray<Doc<'resourceMapPins'>>,
  requested: Extract<StoredMapContentCommand, { type: 'createPins' }>['pins'],
): Promise<MapCommandPlan | ReturnType<typeof rejected>> {
  if (
    requested.length === 0 ||
    requested.length > MAX_MAP_PINS_PER_COMMAND ||
    pins.length + requested.length > MAX_MAP_PINS
  ) {
    return rejected('invalid_command')
  }
  const layers = new Set(layerIds)
  const ids = new Set(pins.map((pin) => pin.mapPinUuid))
  const destinations = new Set(pins.map((pin) => serializeStoredDestination(pin.destination)))
  const additions: Array<MapPinValue> = []
  for (const candidate of requested) {
    const pin = readNewMapPin(candidate, campaignId, resourceId)
    if (
      !pin ||
      ids.has(pin.mapPinUuid) ||
      destinations.has(serializeStoredDestination(pin.destination)) ||
      (pin.layerId !== null && !layers.has(pin.layerId)) ||
      (pin.destination.kind === 'internal' && pin.destination.target.resourceId === resourceId)
    ) {
      return rejected('invalid_command')
    }
    ids.add(pin.mapPinUuid)
    destinations.add(serializeStoredDestination(pin.destination))
    additions.push(pin)
  }
  if (
    !(await mapTargetsExist(
      ctx,
      campaignId,
      additions.map((pin) => pin.destination),
    ))
  ) {
    return rejected('target_missing')
  }
  return {
    pins: [...pins, ...additions],
    writes: additions.map((pin) => ({ type: 'insert' as const, pin })),
  }
}

function planMapPinMove(
  pins: ReadonlyArray<Doc<'resourceMapPins'>>,
  pinIdValue: string,
  position: { x: number; y: number },
): MapCommandPlan | ReturnType<typeof rejected> {
  if (!isMapPosition(position)) return rejected('invalid_command')
  return planMapPinPatch(pins, pinIdValue, { x: position.x, y: position.y })
}

function planMapPinVisibility(
  pins: ReadonlyArray<Doc<'resourceMapPins'>>,
  pinIdValue: string,
  visible: boolean,
): MapCommandPlan | ReturnType<typeof rejected> {
  return planMapPinPatch(pins, pinIdValue, { visible })
}

function planMapPinPatch(
  pins: ReadonlyArray<Doc<'resourceMapPins'>>,
  pinIdValue: string,
  values: Partial<Pick<MapPinValue, 'visible' | 'x' | 'y'>>,
): MapCommandPlan | ReturnType<typeof rejected> {
  const pinId = assertDomainId(DOMAIN_ID_KIND.mapPin, pinIdValue)
  const pin = pins.find((candidate) => candidate.mapPinUuid === pinId)
  if (!pin) return rejected('pin_missing')
  return {
    pins: pins.map((candidate) =>
      candidate._id === pin._id ? { ...candidate, ...values } : candidate,
    ),
    writes: [{ type: 'patch', id: pin._id, values }],
  }
}

function planMapPinRemoval(
  pins: ReadonlyArray<Doc<'resourceMapPins'>>,
  pinIdValue: string,
): MapCommandPlan | ReturnType<typeof rejected> {
  const pinId = assertDomainId(DOMAIN_ID_KIND.mapPin, pinIdValue)
  const pin = pins.find((candidate) => candidate.mapPinUuid === pinId)
  return pin
    ? {
        pins: pins.filter((candidate) => candidate._id !== pin._id),
        writes: [{ type: 'delete', id: pin._id }],
      }
    : rejected('pin_missing')
}

function readNewMapPin(
  candidate: Extract<StoredMapContentCommand, { type: 'createPins' }>['pins'][number],
  campaignId: CampaignId,
  resourceId: ResourceId,
): MapPinValue | null {
  const destination = parseAuthoredDestination(candidate.destination)
  if (!destination || !isMapPosition(candidate)) return null
  return {
    campaignUuid: campaignId,
    mapResourceUuid: resourceId,
    mapPinUuid: assertDomainId(DOMAIN_ID_KIND.mapPin, candidate.id),
    destination,
    layerId: candidate.layerId,
    visible: true,
    x: candidate.x,
    y: candidate.y,
  }
}

async function mapTargetsExist(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  values: ReadonlyArray<unknown>,
): Promise<boolean> {
  const destinations = values.map(parseAuthoredDestination)
  if (destinations.some((destination) => destination === null)) return false
  const resourceIds = Array.from(
    new Set(
      destinations.flatMap((destination) =>
        destination?.kind === 'internal' ? [destination.target.resourceId] : [],
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

function serializeStoredDestination(value: unknown): string {
  const destination = parseAuthoredDestination(value)
  if (!destination) throw new TypeError('Invalid authored destination')
  return serializeAuthoredDestination(destination)
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
