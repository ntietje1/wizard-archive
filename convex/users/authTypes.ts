import type { UserIdentity } from 'convex/server'
import type { Doc } from '../_generated/dataModel'
import type { AssetId } from '@wizard-archive/editor/resources/domain-id'

type AuthenticatedUserProfile = Omit<Doc<'userProfiles'>, 'profileImage'> & {
  profileImage: { type: 'external'; url: string } | { type: 'asset'; assetId: AssetId } | null
}

export type AuthUser = { identity: UserIdentity; profile: AuthenticatedUserProfile }
