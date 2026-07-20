import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { patchWorkspacePreferences } from './functions'
import { workspacePreferencePatchValidator } from './schema'

export const patch = campaignMutation({
  args: { patch: workspacePreferencePatchValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    await patchWorkspacePreferences(ctx, args.patch)
    return null
  },
})
