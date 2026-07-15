import type { Infer } from 'convex/values'
import type { Doc } from '../_generated/dataModel'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../functions'
import type {
  workspacePreferenceChangeValidator,
  workspacePreferencesSnapshotValidator,
} from './schema'

type WorkspacePreferenceChange = Infer<typeof workspacePreferenceChangeValidator>
export type StoredWorkspacePreferencesSnapshot = Infer<typeof workspacePreferencesSnapshotValidator>

export const DEFAULT_STORED_WORKSPACE_PREFERENCES: StoredWorkspacePreferencesSnapshot = {
  revision: 0,
  value: {
    mode: 'editor',
    sort: { by: 'title', direction: 'ascending' },
    panels: {
      left: { size: 288, visible: true },
      right: { size: 280, visible: false },
    },
  },
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
): Promise<StoredWorkspacePreferencesSnapshot> {
  const row = await findWorkspacePreferences(ctx)
  return row ? snapshot(row) : DEFAULT_STORED_WORKSPACE_PREFERENCES
}

export async function changeWorkspacePreferences(
  ctx: CampaignMutationCtx,
  change: WorkspacePreferenceChange,
): Promise<StoredWorkspacePreferencesSnapshot> {
  const current = await findWorkspacePreferences(ctx)
  const currentSnapshot = current ? snapshot(current) : DEFAULT_STORED_WORKSPACE_PREFERENCES
  const next: StoredWorkspacePreferencesSnapshot = {
    revision: currentSnapshot.revision + 1,
    value: applyChange(currentSnapshot.value, change),
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

function snapshot(row: Doc<'workspacePreferences'>): StoredWorkspacePreferencesSnapshot {
  return { revision: row.revision, value: row.value }
}

function applyChange(
  current: StoredWorkspacePreferencesSnapshot['value'],
  change: WorkspacePreferenceChange,
): StoredWorkspacePreferencesSnapshot['value'] {
  switch (change.type) {
    case 'mode':
      return { ...current, mode: change.mode }
    case 'sort':
      return { ...current, sort: change.sort }
    case 'panel': {
      const panel = current.panels[change.panel]
      return {
        ...current,
        panels: {
          ...current.panels,
          [change.panel]: {
            size: change.size === undefined ? panel.size : boundedPanelSize(change.size),
            visible: change.visible ?? panel.visible,
          },
        },
      }
    }
  }
}

function boundedPanelSize(size: number) {
  if (!Number.isFinite(size)) return 280
  return Math.min(600, Math.max(200, Math.round(size)))
}
