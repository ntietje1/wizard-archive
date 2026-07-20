import {
  applyWorkspacePreferencePatch,
  DEFAULT_WORKSPACE_PREFERENCES,
  normalizeWorkspacePreferences,
} from '@wizard-archive/editor/resources/workspace-preferences'
import type {
  WorkspacePreferencePatch,
  WorkspacePreferences,
} from '@wizard-archive/editor/resources/workspace-preferences'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../functions'

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
): Promise<WorkspacePreferences> {
  const row = await findWorkspacePreferences(ctx)
  return row ? normalizeWorkspacePreferences(row.value) : DEFAULT_WORKSPACE_PREFERENCES
}

export async function patchWorkspacePreferences(
  ctx: CampaignMutationCtx,
  patch: WorkspacePreferencePatch,
): Promise<void> {
  const current = await findWorkspacePreferences(ctx)
  const next = applyWorkspacePreferencePatch(
    current ? normalizeWorkspacePreferences(current.value) : DEFAULT_WORKSPACE_PREFERENCES,
    patch,
  )

  if (current) {
    await ctx.db.patch('workspacePreferences', current._id, { value: next })
  } else {
    await ctx.db.insert('workspacePreferences', {
      campaignUuid: ctx.resourceScope.campaignId,
      userId: ctx.membership.userId,
      value: next,
    })
  }
}
