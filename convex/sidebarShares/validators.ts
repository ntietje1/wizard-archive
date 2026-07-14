import { v } from 'convex/values'
import type { Validator } from 'convex/values'
import type { ResourceShareId } from '@wizard-archive/editor/resources/domain-id'

export const resourceShareIdValidator = v.string() as Validator<ResourceShareId>
