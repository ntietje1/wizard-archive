import { v } from 'convex/values'
import type { Validator } from 'convex/values'
import type { OperationId } from '@wizard-archive/editor/resources/domain-id'

export const operationIdValidator = v.string() as Validator<OperationId>
