import type { UserIdentity } from 'convex/server'

export type AuthProfileKey = string

export function getAuthProfileKey(
  identity: Pick<UserIdentity, 'subject' | 'tokenIdentifier'>,
): AuthProfileKey {
  // Better Auth is the provider-specific exception to Convex's general tokenIdentifier guidance:
  // its Convex client maps the Better Auth user document `_id` from identity.subject.
  return identity.subject
}
