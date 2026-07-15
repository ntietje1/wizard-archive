import { campaignQuery } from '../functions'
import { loadWorkspacePreferences } from './functions'
import { workspacePreferencesSnapshotValidator } from './schema'

export const get = campaignQuery({
  args: {},
  returns: workspacePreferencesSnapshotValidator,
  handler: loadWorkspacePreferences,
})
