import type { UserIdentity } from 'convex/server'
import type { UserProfileFromDb } from '../../shared/users/types'

export type AuthUser = { identity: UserIdentity; profile: UserProfileFromDb }
