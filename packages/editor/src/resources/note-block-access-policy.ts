import { DOMAIN_ID_KIND, assertDomainId } from './domain-id'
import type { CampaignMemberId, NoteBlockId, ResourceId } from './domain-id'
import { RESOURCE_PERMISSION, resourcePermissionAllows } from './resource-access-policy'
import type { ResourcePermission } from './resource-access-policy'

export const NOTE_BLOCK_VISIBILITY = {
  hidden: 'hidden',
  visible: 'visible',
} as const

export type NoteBlockVisibility = (typeof NOTE_BLOCK_VISIBILITY)[keyof typeof NOTE_BLOCK_VISIBILITY]

export type NoteBlockMemberAccess = Readonly<{
  memberId: CampaignMemberId
  visibility: NoteBlockVisibility
}>

export type NoteBlockAccessPolicy = Readonly<{
  blockId: NoteBlockId
  audienceVisibility: NoteBlockVisibility
  memberAccess: ReadonlyArray<NoteBlockMemberAccess>
}>

export type NoteBlockAccessParticipant = Readonly<{
  id: CampaignMemberId
  displayName: string
  username: string
  imageUrl: string | null
  notePermission: ResourcePermission
}>

export type NoteBlockAccessPresentation = Readonly<{
  noteId: ResourceId
  blocks: ReadonlyArray<NoteBlockAccessPolicy>
  participants: ReadonlyArray<NoteBlockAccessParticipant>
  participantsComplete: boolean
}>

export type AggregateNoteBlockVisibility = NoteBlockVisibility | 'mixed'

export type NoteBlockSelectionParticipant =
  | Readonly<{
      kind: 'locked_visible'
      participant: NoteBlockAccessParticipant
    }>
  | Readonly<{
      kind: 'controllable'
      participant: NoteBlockAccessParticipant
      visibility: AggregateNoteBlockVisibility | 'default'
      hasExplicitAccess: boolean
    }>

export type NoteBlockSelectionAccess = Readonly<{
  audienceVisibility: AggregateNoteBlockVisibility
  participants: ReadonlyArray<NoteBlockSelectionParticipant>
}>

export const MAX_NOTE_BLOCK_ACCESS_COMMAND_BLOCKS = 100

export function normalizeNoteBlockAccessSelection(
  blockIds: ReadonlyArray<NoteBlockId>,
): ReadonlyArray<NoteBlockId> {
  const normalized = Array.from(
    new Set(blockIds.map((blockId) => assertDomainId(DOMAIN_ID_KIND.noteBlock, blockId))),
  ).sort()
  if (normalized.length === 0) throw new TypeError('A note block selection cannot be empty')
  if (normalized.length > MAX_NOTE_BLOCK_ACCESS_COMMAND_BLOCKS) {
    throw new TypeError('Note block access selection is too large')
  }
  return normalized
}

export function noteBlockIsVisible(
  notePermission: ResourcePermission,
  audienceVisibility: NoteBlockVisibility,
  memberVisibility?: NoteBlockVisibility,
): boolean {
  if (!resourcePermissionAllows(notePermission, RESOURCE_PERMISSION.view)) return false
  if (resourcePermissionAllows(notePermission, RESOURCE_PERMISSION.edit)) return true
  return (memberVisibility ?? audienceVisibility) === NOTE_BLOCK_VISIBILITY.visible
}

export function projectNoteBlockSelectionAccess(
  presentation: NoteBlockAccessPresentation,
  blockIds: ReadonlyArray<NoteBlockId>,
): NoteBlockSelectionAccess | null {
  if (blockIds.length === 0) return null
  const policies = new Map(presentation.blocks.map((policy) => [policy.blockId, policy]))
  const selected = blockIds.map((blockId) => policies.get(blockId))
  if (selected.some((policy) => policy === undefined)) return null
  const blocks = selected as ReadonlyArray<NoteBlockAccessPolicy>
  return {
    audienceVisibility: aggregate(blocks.map((block) => block.audienceVisibility)),
    participants: presentation.participants.map((participant) =>
      projectParticipant(participant, blocks),
    ),
  }
}

function projectParticipant(
  participant: NoteBlockAccessParticipant,
  blocks: ReadonlyArray<NoteBlockAccessPolicy>,
): NoteBlockSelectionParticipant {
  if (resourcePermissionAllows(participant.notePermission, RESOURCE_PERMISSION.edit)) {
    return { kind: 'locked_visible', participant }
  }
  const values = blocks.map((block) => {
    const access = block.memberAccess.find((entry) => entry.memberId === participant.id)
    return access?.visibility ?? 'default'
  })
  return {
    kind: 'controllable',
    participant,
    visibility: aggregate(values),
    hasExplicitAccess: values.some((value) => value !== 'default'),
  }
}

function aggregate<T extends string>(values: ReadonlyArray<T>): T | 'mixed' {
  const first = values[0]
  if (first === undefined) throw new TypeError('Cannot aggregate an empty block selection')
  return values.every((value) => value === first) ? first : 'mixed'
}
