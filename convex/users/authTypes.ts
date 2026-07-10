import type { UserIdentity } from 'convex/server'
import type { UserProfileRow } from '../../shared/users/types'

export type AuthUser = { identity: UserIdentity; profile: UserProfileRow }
