import type { ResourceId } from '../../resources/domain-id'
export interface MapTransformState {
  scale: number
  positionX: number
  positionY: number
}

export const DEFAULT_MAP_TRANSFORM = {
  scale: 1,
  positionX: 0,
  positionY: 0,
} satisfies MapTransformState

export interface MapTransformStore {
  loadMapTransform: (mapId: ResourceId) => MapTransformState
  saveMapTransform: (mapId: ResourceId, value: MapTransformState) => void
}
