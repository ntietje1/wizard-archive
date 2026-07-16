import { DOMAIN_ID_KIND, generateDomainId } from '../resources/domain-id'
import type { ResourceId } from '../resources/domain-id'
import type { MapContentCommand, MapResourceContent } from '../resources/content-session-contract'

export function planMapResourcePins({
  existingPins,
  layerId,
  mapResourceId,
  position,
  resourceIds,
}: {
  existingPins: MapResourceContent['pins']
  layerId: string | null
  mapResourceId: ResourceId
  position: { x: number; y: number }
  resourceIds: ReadonlyArray<ResourceId>
}): Extract<MapContentCommand, { type: 'createPins' }> | null {
  const existingTargets = new Set(
    existingPins.flatMap((pin) =>
      pin.destination.kind === 'internal' ? [pin.destination.target.resourceId] : [],
    ),
  )
  const unique = Array.from(new Set(resourceIds)).filter(
    (resourceId) => resourceId !== mapResourceId && !existingTargets.has(resourceId),
  )
  return unique.length === 0
    ? null
    : {
        type: 'createPins',
        pins: unique.map((resourceId, index) => ({
          id: generateDomainId(DOMAIN_ID_KIND.mapPin),
          destination: { kind: 'internal', target: { kind: 'resource', resourceId } },
          layerId,
          ...offsetPinPosition(position, index, unique.length),
        })),
      }
}

function offsetPinPosition(
  position: { x: number; y: number },
  index: number,
  count: number,
): { x: number; y: number } {
  const row = Math.floor(index / 8)
  const rowStart = row * 8
  const rowSize = Math.min(8, count - rowStart)
  const column = index - rowStart
  return {
    x: Math.max(0, Math.min(100, position.x + (column - (rowSize - 1) / 2) * 2)),
    y: Math.max(0, Math.min(100, position.y + row * 2)),
  }
}
