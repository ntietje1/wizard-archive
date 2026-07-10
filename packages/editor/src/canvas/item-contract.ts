import type { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import type {
  BaseResource,
  BaseResourceRow,
  BaseResourceWithContent,
} from '../workspace/resource-contract'

export type CanvasItemRow = BaseResourceRow<typeof RESOURCE_TYPES.canvases>
export type CanvasItem = BaseResource<typeof RESOURCE_TYPES.canvases>
export type CanvasItemWithContent = BaseResourceWithContent<typeof RESOURCE_TYPES.canvases>
