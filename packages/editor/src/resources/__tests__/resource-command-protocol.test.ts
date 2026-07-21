import { describe, expect, it } from 'vite-plus/test'
import { DOMAIN_ID_KIND, assertDomainId, generateDomainId } from '../domain-id'
import { MAX_RESOURCE_ACCESS_COMMAND_RESOURCES } from '../resource-access-policy'
import type { NoteBlockAccessCommand, ResourceAccessCommand } from '../resource-command-contract'
import {
  encodeResourceStructureCommand,
  fingerprintNoteBlockAccessCommand,
  fingerprintResourceAccessCommand,
  fingerprintResourceStructureCommand,
  normalizeNoteBlockAccessCommand,
  normalizeResourceAccessCommand,
  normalizeResourceStructureCommand,
} from '../resource-command-protocol'
import { RESOURCE_KIND, canonicalizeResourceTitle } from '../resource-record'

const resourceA = assertDomainId(DOMAIN_ID_KIND.resource, '01890f47-f6c8-7a5b-8c9d-0123456789a1')
const resourceB = assertDomainId(DOMAIN_ID_KIND.resource, '01890f47-f6c8-7a5b-8c9d-0123456789a2')
const memberId = assertDomainId(
  DOMAIN_ID_KIND.campaignMember,
  '01890f47-f6c8-7a5b-8c9d-0123456789a3',
)
const blockId = assertDomainId(DOMAIN_ID_KIND.noteBlock, '01890f47-f6c8-7a5b-8c9d-0123456789a4')

describe('resource-command-v1 normalization', () => {
  it('deduplicates and sorts set-like resource selections', () => {
    expect(
      normalizeResourceStructureCommand({
        type: 'move',
        resourceIds: [resourceB, resourceA, resourceB],
        destinationParentId: null,
      }),
    ).toEqual({
      type: 'move',
      resourceIds: [resourceA, resourceB],
      destinationParentId: null,
    })
  })

  it('canonicalizes titles and metadata field order', () => {
    expect(
      normalizeResourceStructureCommand({
        type: 'create',
        resourceId: resourceA,
        kind: RESOURCE_KIND.note,
        parentId: null,
        title: canonicalizeResourceTitle('  e\u0301\nNotes  '),
        icon: null,
        color: null,
      }),
    ).toEqual({
      type: 'create',
      resourceId: resourceA,
      kind: RESOURCE_KIND.note,
      parentId: null,
      title: 'é Notes',
      icon: null,
      color: null,
    })
  })

  it('freezes protocol bytes and fingerprints after normalization', async () => {
    const command = {
      type: 'move',
      resourceIds: [resourceB, resourceA, resourceB],
      destinationParentId: null,
    } as const

    expect(new TextDecoder().decode(encodeResourceStructureCommand(command))).toBe(
      `{"protocolVersion":"resource-command-v1","family":"structure","command":{"type":"move","resourceIds":["${resourceA}","${resourceB}"],"destinationParentId":null}}`,
    )
    await expect(fingerprintResourceStructureCommand(command)).resolves.toBe(
      'ac6120caa9cebcd05138c227348cf26088187b3b9cf128ec7f57fddf9e07c151',
    )
  })

  it('rejects invalid identities and empty set-like commands', () => {
    expect(() =>
      normalizeResourceStructureCommand({
        type: 'trash',
        resourceIds: ['sidebar-item-1' as typeof resourceA],
      }),
    ).toThrow(/UUIDv7/)
    expect(() =>
      normalizeResourceStructureCommand({
        type: 'restore',
        resourceIds: [],
        destination: 'previousParent',
      }),
    ).toThrow(/cannot be empty/)
    expect(() =>
      normalizeResourceStructureCommand({
        type: 'updateMetadata',
        resourceId: resourceA,
        changes: {},
      }),
    ).toThrow(/cannot be empty/)
    expect(() =>
      normalizeResourceStructureCommand({
        type: 'create',
        resourceId: resourceA,
        kind: RESOURCE_KIND.note,
        parentId: null,
        title: canonicalizeResourceTitle('Entry'),
        icon: 1 as unknown as string,
        color: null,
      }),
    ).toThrow(/resource icon/)
  })
})

describe('separate command families', () => {
  it('normalizes access and note-block access independently', async () => {
    const access = {
      type: 'setMemberAccess',
      resourceIds: [resourceA],
      memberId,
      permission: 'view',
    } satisfies ResourceAccessCommand
    const blockAccess = {
      type: 'setNoteBlockMemberAccess',
      noteId: resourceA,
      blockIds: [blockId],
      memberId,
      permission: 'view',
    } satisfies NoteBlockAccessCommand

    expect(
      normalizeResourceAccessCommand({ ...access, resourceIds: [resourceB, resourceA, resourceB] }),
    ).toEqual({ ...access, resourceIds: [resourceA, resourceB] })
    expect(
      normalizeResourceAccessCommand({
        type: 'clearAudienceAccess',
        resourceIds: [resourceB, resourceA, resourceB],
      }),
    ).toEqual({ type: 'clearAudienceAccess', resourceIds: [resourceA, resourceB] })
    expect(normalizeNoteBlockAccessCommand(blockAccess)).toEqual(blockAccess)

    const fingerprints = await Promise.all([
      fingerprintResourceAccessCommand(access),
      fingerprintNoteBlockAccessCommand(blockAccess),
    ])
    expect(new Set(fingerprints).size).toBe(2)
  })

  it('rejects non-boolean note-block access state at the protocol boundary', () => {
    expect(() =>
      normalizeNoteBlockAccessCommand({
        type: 'setNoteBlockAudienceAccess',
        noteId: resourceA,
        blockIds: [blockId],
        shared: 1 as unknown as boolean,
      }),
    ).toThrow(/audience state/)
  })

  it('accepts only finite folder access inheritance states', () => {
    expect(
      normalizeResourceAccessCommand({
        type: 'setFolderAccessInheritance',
        folderId: resourceA,
        inheritance: 'enabled',
      }),
    ).toEqual({
      type: 'setFolderAccessInheritance',
      folderId: resourceA,
      inheritance: 'enabled',
    })
    expect(() =>
      normalizeResourceAccessCommand({
        type: 'setFolderAccessInheritance',
        folderId: resourceA,
        inheritance: true as unknown as 'enabled',
      }),
    ).toThrow(/inheritance state/)
  })

  it('bounds access selections after deduplication', () => {
    const resourceIds = Array.from({ length: MAX_RESOURCE_ACCESS_COMMAND_RESOURCES }, () =>
      generateDomainId(DOMAIN_ID_KIND.resource),
    )
    const normalized = normalizeResourceAccessCommand({
      type: 'clearAudienceAccess',
      resourceIds: [...resourceIds, resourceIds[0]!],
    })
    if (normalized.type !== 'clearAudienceAccess') throw new TypeError('Unexpected command')
    expect(normalized.resourceIds).toHaveLength(MAX_RESOURCE_ACCESS_COMMAND_RESOURCES)
    expect(() =>
      normalizeResourceAccessCommand({
        type: 'clearAudienceAccess',
        resourceIds: [...resourceIds, generateDomainId(DOMAIN_ID_KIND.resource)],
      }),
    ).toThrow(/too large/)
  })
})
