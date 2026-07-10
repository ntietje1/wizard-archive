import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { campaignMutation } from '../functions'
import { editorModeValidator } from './schema'
import { setCurrentEditor as setCurrentEditorFn } from './functions/setCurrentEditor'
import type { Id } from '../_generated/dataModel'
import {
  SORT_DIRECTION_VALUES,
  SORT_ORDER_VALUES,
} from '@wizard-archive/editor/resources/items-persistence-contract'

export const setCurrentEditor = campaignMutation({
  args: {
    sortOrder: v.optional(literals(...SORT_ORDER_VALUES)),
    sortDirection: v.optional(literals(...SORT_DIRECTION_VALUES)),
    editorMode: v.optional(editorModeValidator),
  },
  returns: v.id('editor'),
  handler: async (ctx, args): Promise<Id<'editor'>> => {
    return setCurrentEditorFn(ctx, {
      sortOrder: args.sortOrder,
      sortDirection: args.sortDirection,
      editorMode: args.editorMode,
    })
  },
})
