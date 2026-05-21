import { createClient } from '@convex-dev/better-auth'
import { components, internal } from '../_generated/api'
import { onCreateUser } from './functions/onCreateUser'
import { onUpdateUser } from './functions/onUpdateUser'
import { onDeleteUser } from './functions/onDeleteUser'
import type { AuthFunctions } from '@convex-dev/better-auth'
import type { DataModel } from '../_generated/dataModel'

const authFunctions: AuthFunctions = internal.auth.component

export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, user) => onCreateUser(ctx, user),
      onUpdate: async (ctx, newUser, oldUser) => onUpdateUser(ctx, newUser, oldUser),
      onDelete: async (ctx, user) => onDeleteUser(ctx, user),
    },
  },
})
