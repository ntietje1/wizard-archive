import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { authMutation } from '../functions'

const VALID_PANEL_IDS = ['left-sidebar', 'editor-right-sidebar'] as const

export const setUserPreferences = authMutation({
  args: {
    theme: v.optional(literals('light', 'dark', 'system')),
  },
  returns: v.id('userPreferences'),
  handler: async (ctx, args) => {
    const now = Date.now()
    const userId = ctx.user.profile._id

    const existing = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()

    if (!existing) {
      return await ctx.db.insert('userPreferences', {
        userId,
        theme: args.theme ?? null,
        panelPreferences: null,
        deletionTime: null,
        deletedBy: null,
        updatedTime: null,
        updatedBy: null,
        createdBy: userId,
      })
    } else {
      await ctx.db.patch('userPreferences', existing._id, {
        ...args,
        updatedTime: now,
        updatedBy: userId,
      })

      return existing._id
    }
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

    const now = Date.now()
    const userId = ctx.user.profile._id

    const existing = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique()

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

    if (!existing) {
      return await ctx.db.insert('userPreferences', {
        userId,
        theme: null,
        panelPreferences: updatedPrefs,
        deletionTime: null,
        deletedBy: null,
        updatedTime: null,
        updatedBy: null,
        createdBy: userId,
      })
    } else {
      await ctx.db.patch('userPreferences', existing._id, {
        panelPreferences: updatedPrefs,
        updatedTime: now,
        updatedBy: userId,
      })

      return existing._id
    }
  },
})
