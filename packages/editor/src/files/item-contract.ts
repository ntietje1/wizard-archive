import type { AssetId } from '../resources/domain-id'
import type { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import type {
  BaseResource,
  BaseResourceRow,
  BaseResourceWithContent,
} from '../workspace/resource-contract'

export type FileItemRow = BaseResourceRow<typeof RESOURCE_TYPES.files> & {
  assetId: AssetId | null
}

export type FileItem = BaseResource<typeof RESOURCE_TYPES.files> & {
  assetId: AssetId | null
  downloadUrl: string | null
  contentType: string | null
}

export type FileItemWithContent = BaseResourceWithContent<typeof RESOURCE_TYPES.files> & {
  assetId: AssetId | null
  downloadUrl: string | null
  contentType: string | null
}
