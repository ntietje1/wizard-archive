import {
  applyWorkspacePreferenceChange,
  DEFAULT_WORKSPACE_PREFERENCES,
} from '@wizard-archive/editor/resources/workspace-preferences'
import type {
  WorkspacePreferenceChange,
  WorkspacePreferencesSnapshot,
} from '@wizard-archive/editor/resources/workspace-preferences'
import type { Doc } from '../_generated/dataModel'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../functions'

const DEFAULT_WORKSPACE_PREFERENCES_SNAPSHOT: WorkspacePreferencesSnapshot = {
  revision: 0,
  value: DEFAULT_WORKSPACE_PREFERENCES,
}

type WorkspacePreferencesCtx = CampaignQueryCtx | CampaignMutationCtx

async function findWorkspacePreferences(ctx: WorkspacePreferencesCtx) {
  return await ctx.db
    .query('workspacePreferences')
    .withIndex('by_campaign_user', (query) =>
      query.eq('campaignUuid', ctx.resourceScope.campaignId).eq('userId', ctx.membership.userId),
    )
    .unique()
}

export async function loadWorkspacePreferences(
  ctx: CampaignQueryCtx,
): Promise<WorkspacePreferencesSnapshot> {
  const row = await findWorkspacePreferences(ctx)
  return row ? snapshot(row) : DEFAULT_WORKSPACE_PREFERENCES_SNAPSHOT
}

export async function changeWorkspacePreferences(
  ctx: CampaignMutationCtx,
  change: WorkspacePreferenceChange,
): Promise<WorkspacePreferencesSnapshot> {
  const current = await findWorkspacePreferences(ctx)
  const currentSnapshot = current ? snapshot(current) : DEFAULT_WORKSPACE_PREFERENCES_SNAPSHOT
  const next: WorkspacePreferencesSnapshot = {
    revision: currentSnapshot.revision + 1,
    value: applyWorkspacePreferenceChange(currentSnapshot.value, change),
  }

  if (current) {
    await ctx.db.patch('workspacePreferences', current._id, next)
  } else {
    await ctx.db.insert('workspacePreferences', {
      campaignUuid: ctx.resourceScope.campaignId,
      userId: ctx.membership.userId,
      ...next,
    })
  }
  return next
}

function snapshot(row: Doc<'workspacePreferences'>): WorkspacePreferencesSnapshot {
  return { revision: row.revision, value: row.value }
}
