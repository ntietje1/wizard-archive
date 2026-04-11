import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { editorValidator } from './schema'
import { getCurrentEditor as getCurrentEditorFn } from './functions/getCurrentEditor'
import type { Editor } from './types'

export const getCurrentEditor = campaignQuery({
  args: {},
  returns: v.union(v.null(), editorValidator),
  handler: async (ctx): Promise<Editor | null> => {
    return getCurrentEditorFn(ctx)
  },
})
