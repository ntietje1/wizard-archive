import type { UserIdentity } from 'convex/server'
import type { Id } from '../_generated/dataModel'

export type UserProfile = {
  _id: Id<'userProfiles'>
  _creationTime: number

  clerkUserId: string
  username: string
  email?: string
  name?: string
  firstName?: string
  lastName?: string
  imageUrl?: string
  updatedAt: number
}

export type AuthUser = { identity: UserIdentity; profile: UserProfile }
