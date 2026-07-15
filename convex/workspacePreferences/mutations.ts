import { campaignMutation } from '../functions'
import { changeWorkspacePreferences } from './functions'
import { workspacePreferenceChangeValidator, workspacePreferencesSnapshotValidator } from './schema'

export const change = campaignMutation({
  args: { change: workspacePreferenceChangeValidator },
  returns: workspacePreferencesSnapshotValidator,
  handler: async (ctx, args) => await changeWorkspacePreferences(ctx, args.change),
})
