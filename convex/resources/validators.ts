import { v } from 'convex/values'
import type { Validator } from 'convex/values'
import type { AssetId, OperationId } from '@wizard-archive/editor/resources/domain-id'

export const assetIdValidator = v.string() as Validator<AssetId>
export const operationIdValidator = v.string() as Validator<OperationId>
