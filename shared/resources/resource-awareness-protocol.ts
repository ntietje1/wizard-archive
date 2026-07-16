import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'
import {
  DOMAIN_ID_KIND,
  assertDomainId,
  isUuidV7,
} from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMemberId } from '@wizard-archive/editor/resources/domain-id'

export const RESOURCE_AWARENESS_TTL_MS = 30_000
export const MAX_RESOURCE_AWARENESS_CLIENTS = 256
const MAX_RESOURCE_AWARENESS_UPDATE_BYTES = 2_048

const COLLABORATION_COLORS = [
  '#e06c75',
  '#e5c07b',
  '#98c379',
  '#56b6c2',
  '#61afef',
  '#c678dd',
  '#d19a66',
  '#be5046',
] as const

type ResourceAwarenessUser = Readonly<{
  name: string
  color: string
}>

type AwarenessState = Record<string, unknown> & {
  memberId: CampaignMemberId
  user: ResourceAwarenessUser
}

type DecodedAwarenessUpdate = Readonly<{
  clientId: number
  clock: number
  state: AwarenessState
}>

type ResourceAwarenessUpdateRejection = 'invalid_update' | 'payload_too_large'

export function collaborationColor(memberId: CampaignMemberId): string {
  let hash = 0
  for (const character of memberId) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0
  return COLLABORATION_COLORS[Math.abs(hash) % COLLABORATION_COLORS.length]
}

export function validateResourceAwarenessIdentity(clientId: number, leaseId: string): boolean {
  return (
    Number.isSafeInteger(clientId) && clientId >= 0 && clientId <= 0xffff_ffff && isUuidV7(leaseId)
  )
}

export function authenticateResourceAwarenessUpdate(
  update: ArrayBuffer,
  claimedClientId: number,
  memberId: CampaignMemberId,
  user: ResourceAwarenessUser,
):
  | { status: 'accepted'; update: ArrayBuffer }
  | { status: 'rejected'; reason: ResourceAwarenessUpdateRejection } {
  if (update.byteLength > MAX_RESOURCE_AWARENESS_UPDATE_BYTES) {
    return { status: 'rejected', reason: 'payload_too_large' }
  }
  const decoded = decodeWireUpdate(new Uint8Array(update))
  if (!decoded || decoded.clientId !== claimedClientId || decoded.state === null) {
    return { status: 'rejected', reason: 'invalid_update' }
  }
  const authenticated = encodeWireUpdate({
    ...decoded,
    state: { ...decoded.state, memberId, user },
  })
  if (authenticated.byteLength > MAX_RESOURCE_AWARENESS_UPDATE_BYTES) {
    return { status: 'rejected', reason: 'payload_too_large' }
  }
  return { status: 'accepted', update: Uint8Array.from(authenticated).buffer }
}

export function decodeAuthenticatedResourceAwarenessUpdate(
  update: ArrayBuffer,
  claimedClientId: number,
  claimedMemberId: CampaignMemberId,
): DecodedAwarenessUpdate | null {
  if (update.byteLength > MAX_RESOURCE_AWARENESS_UPDATE_BYTES) return null
  const decoded = decodeWireUpdate(new Uint8Array(update))
  const memberIdValue = decoded?.state?.memberId
  const user = decoded?.state?.user
  if (
    !decoded ||
    decoded.clientId !== claimedClientId ||
    decoded.state === null ||
    typeof memberIdValue !== 'string' ||
    memberIdValue !== claimedMemberId ||
    !isCollaborationUser(user)
  ) {
    return null
  }
  try {
    const memberId = assertDomainId(DOMAIN_ID_KIND.campaignMember, memberIdValue)
    return { ...decoded, state: { ...decoded.state, memberId, user } }
  } catch {
    return null
  }
}

function decodeWireUpdate(
  update: Uint8Array,
): { clientId: number; clock: number; state: Record<string, unknown> | null } | null {
  try {
    const decoder = decoding.createDecoder(update)
    if (decoding.readVarUint(decoder) !== 1) return null
    const clientId = decoding.readVarUint(decoder)
    const clock = decoding.readVarUint(decoder)
    const state: unknown = JSON.parse(decoding.readVarString(decoder))
    if (
      decoding.hasContent(decoder) ||
      !Number.isSafeInteger(clientId) ||
      !Number.isSafeInteger(clock)
    ) {
      return null
    }
    if (state === null) return { clientId, clock, state }
    if (typeof state !== 'object' || Array.isArray(state)) return null
    return { clientId, clock, state: state as Record<string, unknown> }
  } catch {
    return null
  }
}

function encodeWireUpdate(update: {
  clientId: number
  clock: number
  state: Record<string, unknown>
}): Uint8Array {
  const encoder = encoding.createEncoder()
  encoding.writeVarUint(encoder, 1)
  encoding.writeVarUint(encoder, update.clientId)
  encoding.writeVarUint(encoder, update.clock)
  encoding.writeVarString(encoder, JSON.stringify(update.state))
  return encoding.toUint8Array(encoder)
}

function isCollaborationUser(value: unknown): value is ResourceAwarenessUser {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const user = value as Record<string, unknown>
  return typeof user.name === 'string' && typeof user.color === 'string'
}
