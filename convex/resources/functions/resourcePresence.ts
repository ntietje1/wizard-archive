import { Presence } from '@convex-dev/presence'
import {
  DOMAIN_ID_KIND,
  assertDomainId,
  isUuidV7,
} from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMemberId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../../functions'
import { components } from '../../_generated/api'
import { authorizeResourceContentKinds } from './authorizeResourceContent'
import { collaborationColor } from '../../../shared/resources/collaboration-user'

const presence = new Presence<ResourceId, string>(components.presence)
const PRESENCE_HEARTBEAT_MS = 10_000
const MAX_PRESENCE_CLIENTS = 256
const MAX_PRESENCE_UPDATE_BYTES = 2_048

type PresenceUser = Readonly<{ name: string; color: string }>
type StoredPresence = Readonly<{
  clientId: number
  memberId: CampaignMemberId
  state: ArrayBuffer
  user: PresenceUser
}>

export async function heartbeatResourcePresence(
  ctx: CampaignMutationCtx,
  args: { resourceId: ResourceId; clientId: number; sessionId: string },
) {
  const authorization = await authorizeResourceContentKinds(ctx, args.resourceId, [
    'note',
    'canvas',
  ])
  if (authorization.status !== 'authorized') return { status: 'unavailable' as const }
  if (!validClientId(args.clientId) || !isUuidV7(args.sessionId)) {
    return { status: 'rejected' as const, reason: 'invalid_client' as const }
  }
  const tokens = await presence.heartbeat(
    ctx,
    args.resourceId,
    presenceClientKey(ctx.resourceScope.actorId, args.clientId),
    args.sessionId,
    PRESENCE_HEARTBEAT_MS,
  )
  return { status: 'active' as const, ...tokens }
}

export async function updateResourcePresence(
  ctx: CampaignMutationCtx,
  args: { resourceId: ResourceId; clientId: number; state: ArrayBuffer },
) {
  const authorization = await authorizeResourceContentKinds(ctx, args.resourceId, [
    'note',
    'canvas',
  ])
  if (authorization.status !== 'authorized') return { status: 'unavailable' as const }
  if (!validClientId(args.clientId)) {
    return { status: 'rejected' as const, reason: 'invalid_update' as const }
  }
  const memberId = ctx.resourceScope.actorId
  const profile = await ctx.db.get('userProfiles', ctx.membership.userId)
  if (!profile) return { status: 'unavailable' as const }
  if (args.state.byteLength > MAX_PRESENCE_UPDATE_BYTES) {
    return { status: 'rejected' as const, reason: 'payload_too_large' as const }
  }
  const user = {
    name: profile.name?.trim() || profile.username,
    color: collaborationColor(memberId),
  }
  await presence.updateRoomUser(ctx, args.resourceId, presenceClientKey(memberId, args.clientId), {
    clientId: args.clientId,
    memberId,
    state: args.state,
    user,
  } satisfies StoredPresence)
  return { status: 'active' as const }
}

export async function loadResourcePresence(
  ctx: CampaignQueryCtx,
  resourceId: ResourceId,
  roomToken: string,
) {
  const authorization = await authorizeResourceContentKinds(ctx, resourceId, ['note', 'canvas'])
  if (authorization.status !== 'authorized') return authorization
  const rows = await presence.list(ctx, roomToken, MAX_PRESENCE_CLIENTS + 1)
  const active = rows.filter((row) => row.online)
  if (active.length > MAX_PRESENCE_CLIENTS) {
    return { status: 'unavailable' as const, reason: 'capacity_exceeded' as const }
  }
  return {
    status: 'ready' as const,
    entries: active.flatMap((row) => {
      const data = readStoredPresence(row.data)
      return data ? [data] : []
    }),
  }
}

export async function disconnectResourcePresence(
  ctx: CampaignMutationCtx,
  resourceId: ResourceId,
  sessionToken: string,
) {
  const authorization = await authorizeResourceContentKinds(ctx, resourceId, ['note', 'canvas'])
  if (authorization.status !== 'authorized') return { status: 'unavailable' as const }
  await presence.disconnect(ctx, sessionToken)
  return { status: 'released' as const }
}

function readStoredPresence(value: unknown): StoredPresence | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const data = value as Record<string, unknown>
  if (
    !validClientId(data.clientId) ||
    typeof data.memberId !== 'string' ||
    !(data.state instanceof ArrayBuffer) ||
    data.state.byteLength > MAX_PRESENCE_UPDATE_BYTES ||
    !validPresenceUser(data.user)
  ) {
    return null
  }
  try {
    return {
      clientId: data.clientId,
      memberId: assertDomainId(DOMAIN_ID_KIND.campaignMember, data.memberId),
      state: data.state,
      user: data.user,
    }
  } catch {
    return null
  }
}

function validPresenceUser(value: unknown): value is PresenceUser {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const user = value as Record<string, unknown>
  return typeof user.name === 'string' && typeof user.color === 'string'
}

function validClientId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 0xffff_ffff
}

function presenceClientKey(memberId: CampaignMemberId, clientId: number): string {
  return `${memberId}:${clientId}`
}
