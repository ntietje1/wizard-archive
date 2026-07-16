import { serializeAuthoredDestination } from './authored-destination'
import {
  advanceVersion,
  compareVersionStamps,
  initialVersion,
  sha256Digest,
} from './component-version'
import type { VersionStamp } from './component-version'
import { isMapPosition } from './content-session-contract'
import type {
  MapContentCommand,
  MapImageAttachment,
  MapResourceContent,
} from './content-session-contract'
import type { MapPinId, ResourceId } from './domain-id'

const MAX_MAP_PINS = 500
const MAX_MAP_PINS_PER_COMMAND = 100

export type MapImageBytes = Readonly<{
  layerId: string | null
  bytes: Uint8Array
}>

export type MapContentTransition =
  | Readonly<{ status: 'completed'; content: MapResourceContent }>
  | Readonly<{ status: 'rejected'; reason: 'content_corrupt' | 'invalid_command' | 'pin_missing' }>

type MapImageTransition =
  | Readonly<{ status: 'completed'; content: MapResourceContent }>
  | Readonly<{ status: 'rejected'; reason: 'layer_missing' }>

export function transitionMapContent(
  resourceId: ResourceId,
  content: MapResourceContent,
  command: MapContentCommand,
): MapContentTransition {
  if (!validMapContent(resourceId, content)) return rejected('content_corrupt')
  switch (command.type) {
    case 'createPins': {
      if (!validPinCreations(resourceId, content, command)) return rejected('invalid_command')
      return {
        status: 'completed',
        content: {
          ...content,
          pins: [...content.pins, ...command.pins.map((pin) => ({ ...pin, visible: true }))],
        },
      }
    }
    case 'movePin': {
      if (!isMapPosition(command)) return rejected('invalid_command')
      return patchPin(content, command.pinId, { x: command.x, y: command.y })
    }
    case 'setPinVisibility':
      return patchPin(content, command.pinId, { visible: command.visible })
    case 'removePin':
      return content.pins.some((pin) => pin.id === command.pinId)
        ? {
            status: 'completed',
            content: { ...content, pins: content.pins.filter((pin) => pin.id !== command.pinId) },
          }
        : rejected('pin_missing')
  }
}

export function replaceMapImageAttachment(
  content: MapResourceContent,
  layerId: string | null,
  image: MapImageAttachment,
): MapImageTransition {
  if (layerId === null) return { status: 'completed', content: { ...content, image } }
  if (!content.layers.some((layer) => layer.id === layerId)) {
    return { status: 'rejected', reason: 'layer_missing' }
  }
  return {
    status: 'completed',
    content: {
      ...content,
      layers: content.layers.map((layer) => (layer.id === layerId ? { ...layer, image } : layer)),
    },
  }
}

export function reconcileMapSnapshot(
  resourceId: ResourceId,
  currentVersion: VersionStamp,
  incomingContent: MapResourceContent,
  incomingVersion: VersionStamp,
): 'apply' | 'retain' | 'conflict' {
  if (!validMapContent(resourceId, incomingContent)) return 'conflict'
  const comparison = compareVersionStamps(incomingVersion, currentVersion)
  switch (comparison.relation) {
    case 'equal':
      return incomingVersion.revision > currentVersion.revision ? 'apply' : 'retain'
    case 'import_newer':
      return 'apply'
    case 'destination_newer':
      return 'retain'
    case 'unknown':
      return 'conflict'
  }
}

export async function initialMapContentVersion(content: MapResourceContent): Promise<VersionStamp> {
  return initialVersion(await mapContentDigest(content))
}

export async function advanceMapContentVersion(
  current: VersionStamp,
  content: MapResourceContent,
): Promise<VersionStamp> {
  return advanceVersion(current, await mapContentDigest(content))
}

export async function copyMapImageBytes(
  content: MapResourceContent,
  images: ReadonlyArray<MapImageBytes>,
): Promise<ReadonlyArray<MapImageBytes>> {
  const expected = attachedMapImages(content)
  const supplied = new Map<string | null, Uint8Array>()
  for (const image of images) {
    if (supplied.has(image.layerId)) throw new TypeError('Duplicate map image bytes')
    supplied.set(image.layerId, image.bytes)
  }
  if (supplied.size !== expected.size) throw new TypeError('Map image bytes are incomplete')
  const copies: Array<MapImageBytes> = []
  for (const [layerId, attachment] of expected) {
    const bytes = supplied.get(layerId)
    if (
      !bytes ||
      bytes.byteLength !== attachment.byteSize ||
      (await sha256Digest(bytes)) !== attachment.digest
    ) {
      throw new TypeError('Map image bytes do not match their attachment')
    }
    copies.push({ layerId, bytes: Uint8Array.from(bytes) })
  }
  return copies
}

export function mapImageAttachment(content: MapResourceContent, layerId: string | null) {
  return layerId === null
    ? content.image
    : content.layers.find((layer) => layer.id === layerId)?.image
}

function validMapContent(resourceId: ResourceId, content: MapResourceContent): boolean {
  if (content.pins.length > MAX_MAP_PINS) return false
  const layerIds = new Set(content.layers.map((layer) => layer.id))
  if (layerIds.size !== content.layers.length) return false
  const pinIds = new Set<string>()
  const destinations = new Set<string>()
  for (const pin of content.pins) {
    const destination = serializeAuthoredDestination(pin.destination)
    if (
      pinIds.has(pin.id) ||
      destinations.has(destination) ||
      !isMapPosition(pin) ||
      (pin.layerId !== null && !layerIds.has(pin.layerId)) ||
      (pin.destination.kind === 'internal' && pin.destination.target.resourceId === resourceId)
    ) {
      return false
    }
    pinIds.add(pin.id)
    destinations.add(destination)
  }
  return true
}

function validPinCreations(
  resourceId: ResourceId,
  content: MapResourceContent,
  command: Extract<MapContentCommand, { type: 'createPins' }>,
): boolean {
  if (
    command.pins.length === 0 ||
    command.pins.length > MAX_MAP_PINS_PER_COMMAND ||
    content.pins.length + command.pins.length > MAX_MAP_PINS
  ) {
    return false
  }
  const layerIds = new Set(content.layers.map((layer) => layer.id))
  const pinIds = new Set(content.pins.map((pin) => pin.id))
  const destinations = new Set(
    content.pins.map((pin) => serializeAuthoredDestination(pin.destination)),
  )
  for (const pin of command.pins) {
    const destination = serializeAuthoredDestination(pin.destination)
    if (
      pinIds.has(pin.id) ||
      destinations.has(destination) ||
      !isMapPosition(pin) ||
      (pin.layerId !== null && !layerIds.has(pin.layerId)) ||
      (pin.destination.kind === 'internal' && pin.destination.target.resourceId === resourceId)
    ) {
      return false
    }
    pinIds.add(pin.id)
    destinations.add(destination)
  }
  return true
}

function patchPin(
  content: MapResourceContent,
  pinId: MapPinId,
  values: Partial<Pick<MapResourceContent['pins'][number], 'visible' | 'x' | 'y'>>,
): MapContentTransition {
  if (!content.pins.some((pin) => pin.id === pinId)) return rejected('pin_missing')
  return {
    status: 'completed',
    content: {
      ...content,
      pins: content.pins.map((pin) => (pin.id === pinId ? { ...pin, ...values } : pin)),
    },
  }
}

function attachedMapImages(content: MapResourceContent) {
  const images = new Map<string | null, Extract<MapImageAttachment, { status: 'attached' }>>()
  if (content.image.status === 'attached') images.set(null, content.image)
  for (const layer of content.layers) {
    if (layer.image.status === 'attached') images.set(layer.id, layer.image)
  }
  return images
}

async function mapContentDigest(content: MapResourceContent) {
  return await sha256Digest(new TextEncoder().encode(JSON.stringify(content)))
}

function rejected(reason: Extract<MapContentTransition, { status: 'rejected' }>['reason']) {
  return { status: 'rejected' as const, reason }
}
