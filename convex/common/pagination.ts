import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'

export const paginatedQueryResultFields = {
  isDone: v.boolean(),
  continueCursor: v.string(),
  splitCursor: v.optional(v.nullable(v.string())),
  pageStatus: v.optional(v.nullable(literals('SplitRecommended', 'SplitRequired'))),
}
