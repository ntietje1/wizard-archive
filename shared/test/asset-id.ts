import type { AssetId } from '@wizard-archive/editor/resources/domain-id'
import { deterministicUuidV7 } from './deterministic-uuid-v7'

export function testAssetId(label: string): AssetId {
  return deterministicUuidV7(label) as AssetId
}
