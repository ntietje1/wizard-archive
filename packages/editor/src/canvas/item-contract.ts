import type { RESOURCE_TYPES } from '../resources/items-persistence-contract'
import type {
  BaseResource,
  BaseResourceRow,
  BaseResourceWithContent,
} from '../resources/resource-contract'

export type CanvasItemRow = BaseResourceRow<typeof RESOURCE_TYPES.canvases>
export type CanvasItem = BaseResource<typeof RESOURCE_TYPES.canvases>
export type CanvasItemWithContent = BaseResourceWithContent<typeof RESOURCE_TYPES.canvases>
