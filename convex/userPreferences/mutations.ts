import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { authMutation } from '../functions'
import type { Doc, Id } from '../_generated/dataModel'
import type { AuthMutationCtx } from '../functions'

const VALID_PANEL_IDS = ['left-sidebar', 'editor-right-sidebar'] as const

type UserPreferencesPatch = Partial<Pick<Doc<'userPreferences'>, 'theme' | 'panelPreferences'>>

async function getUserPreferencesForCurrentUser(ctx: AuthMutationCtx): Promise<{
  userId: Id<'userProfiles'>
  existing: Doc<'userPreferences'> | null
}> {
  const userId = ctx.user.profile._id
  const existing = await ctx.db
    .query('userPreferences')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique()

  return { userId, existing }
}

async function upsertUserPreferences(
  ctx: AuthMutationCtx,
  {
    existing,
    patch,
    userId,
  }: {
    existing: Doc<'userPreferences'> | null
    patch: UserPreferencesPatch
    userId: Id<'userProfiles'>
  },
): Promise<Id<'userPreferences'>> {
  if (!existing) {
    return await ctx.db.insert('userPreferences', {
      userId,
      theme: patch.theme ?? null,
      panelPreferences: patch.panelPreferences ?? null,
    })
  }

  await ctx.db.patch('userPreferences', existing._id, patch)
  return existing._id
}

export const setUserPreferences = authMutation({
  args: {
    theme: v.optional(literals('light', 'dark', 'system')),
  },
  returns: v.id('userPreferences'),
  handler: async (ctx, args) => {
    const { existing, userId } = await getUserPreferencesForCurrentUser(ctx)
    return await upsertUserPreferences(ctx, { existing, patch: args, userId })
  },
})

export const setPanelPreference = authMutation({
  args: {
    panelId: v.string(),
    size: v.optional(v.number()),
    visible: v.optional(v.boolean()),
  },
  returns: v.id('userPreferences'),
  handler: async (ctx, args) => {
    if (!VALID_PANEL_IDS.includes(args.panelId as (typeof VALID_PANEL_IDS)[number])) {
      throw new Error(`Invalid panelId: ${args.panelId}`)
    }

    const { existing, userId } = await getUserPreferencesForCurrentUser(ctx)

    const currentPrefs = existing?.panelPreferences ?? {}

    const currentPanel = currentPrefs[args.panelId] ?? {
      size: null,
      visible: null,
    }

    const updatedPanel = {
      size: args.size !== undefined ? args.size : currentPanel.size,
      visible: args.visible !== undefined ? args.visible : currentPanel.visible,
    }

    const updatedPrefs = {
      ...currentPrefs,
      [args.panelId]: updatedPanel,
    }

    return await upsertUserPreferences(ctx, {
      existing,
      userId,
      patch: {
        panelPreferences: updatedPrefs,
      },
    })
  },
})
