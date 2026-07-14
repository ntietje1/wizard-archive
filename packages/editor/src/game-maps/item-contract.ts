import type { AssetId } from '../resources/domain-id'
import type { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import type {
  BaseResource,
  BaseResourceRow,
  BaseResourceWithContent,
  ResourceByKind,
  ResourceKind,
} from '../workspace/resource-contract'
import type { MapLayer, MapPin } from './document-contract'

type MapPinItem = ResourceByKind<ResourceKind>

type MapImageAssetFields = {
  imageAssetId: AssetId | null
}

type MapImageViewFields = MapImageAssetFields & {
  imageUrl: string | null
  layers?: Array<MapLayer>
}

export type MapPinWithItem<TItem = MapPinItem> = MapPin & {
  item: TItem | null
}

export type MapItemRow = BaseResourceRow<typeof RESOURCE_TYPES.gameMaps> &
  MapImageAssetFields & {
    layers?: Array<{
      id: string
      imageAssetId: AssetId | null
      name: string
    }>
  }

export type MapItem = BaseResource<typeof RESOURCE_TYPES.gameMaps> & MapImageViewFields

export type MapItemWithContent<TItem = MapPinItem> = BaseResourceWithContent<
  typeof RESOURCE_TYPES.gameMaps
> &
  MapImageViewFields & {
    pins: Array<MapPinWithItem<TItem>>
  }
