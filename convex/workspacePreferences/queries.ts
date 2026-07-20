import { campaignQuery } from '../functions'
import { loadWorkspacePreferences } from './functions'
import { workspacePreferencesValueValidator } from './schema'

export const get = campaignQuery({
  args: {},
  returns: workspacePreferencesValueValidator,
  handler: loadWorkspacePreferences,
})
