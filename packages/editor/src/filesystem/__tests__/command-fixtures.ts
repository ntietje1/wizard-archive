import type { CampaignMemberId, SidebarItemId } from '../../../../../shared/common/ids'
import { canonicalizeResourceItemTitle } from '../../workspace/items'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import { RESOURCE_COMMAND_TYPE, RESOURCE_EVENT_TYPE } from '../transaction-contract'
import type { ResourceCommand, ResourceEvent } from '../transaction-contract'
import { DOMAIN_ID_KIND } from '../../resources/domain-id'
import { testDomainId } from '../../test/domain-id'

export const commandFixtureItemIds = {
  item: 'fixture_item' as SidebarItemId,
  source: 'fixture_source' as SidebarItemId,
  destination: 'fixture_destination' as SidebarItemId,
  folder: 'fixture_folder' as SidebarItemId,
  member: 'fixture_member' as CampaignMemberId,
  memberDomain: testDomainId(DOMAIN_ID_KIND.campaignMember, 'fixture_member'),
  note: 'fixture_note' as SidebarItemId,
} as const

export const fileSystemCommandFixtures = {
  [RESOURCE_COMMAND_TYPE.create]: {
    type: RESOURCE_COMMAND_TYPE.create,
    itemType: RESOURCE_TYPES.notes,
    name: canonicalizeResourceItemTitle('Created note'),
    parentTarget: { kind: 'direct', parentId: null },
  },
  [RESOURCE_COMMAND_TYPE.rename]: {
    type: RESOURCE_COMMAND_TYPE.rename,
    itemId: commandFixtureItemIds.item,
    name: canonicalizeResourceItemTitle('Renamed note'),
  },
  [RESOURCE_COMMAND_TYPE.move]: {
    type: RESOURCE_COMMAND_TYPE.move,
    itemIds: [commandFixtureItemIds.source],
    targetParentId: null,
  },
  [RESOURCE_COMMAND_TYPE.copy]: {
    type: RESOURCE_COMMAND_TYPE.copy,
    itemIds: [commandFixtureItemIds.source],
    targetParentId: null,
  },
  [RESOURCE_COMMAND_TYPE.trash]: {
    type: RESOURCE_COMMAND_TYPE.trash,
    itemIds: [commandFixtureItemIds.source],
  },
  [RESOURCE_COMMAND_TYPE.restore]: {
    type: RESOURCE_COMMAND_TYPE.restore,
    itemIds: [commandFixtureItemIds.source],
    targetParentId: null,
  },
  [RESOURCE_COMMAND_TYPE.deleteForever]: {
    type: RESOURCE_COMMAND_TYPE.deleteForever,
    itemIds: [commandFixtureItemIds.source],
  },
  [RESOURCE_COMMAND_TYPE.emptyTrash]: {
    type: RESOURCE_COMMAND_TYPE.emptyTrash,
  },
  [RESOURCE_COMMAND_TYPE.setResourceAudiencePermission]: {
    type: RESOURCE_COMMAND_TYPE.setResourceAudiencePermission,
    itemIds: [commandFixtureItemIds.source],
    permissionLevel: 'view',
  },
  [RESOURCE_COMMAND_TYPE.setResourcesMemberPermission]: {
    type: RESOURCE_COMMAND_TYPE.setResourcesMemberPermission,
    itemIds: [commandFixtureItemIds.source],
    campaignMemberId: commandFixtureItemIds.memberDomain,
    permissionLevel: 'view',
  },
  [RESOURCE_COMMAND_TYPE.clearResourcesMemberPermission]: {
    type: RESOURCE_COMMAND_TYPE.clearResourcesMemberPermission,
    itemIds: [commandFixtureItemIds.source],
    campaignMemberId: commandFixtureItemIds.memberDomain,
  },
  [RESOURCE_COMMAND_TYPE.setFolderInheritShares]: {
    type: RESOURCE_COMMAND_TYPE.setFolderInheritShares,
    folderId: commandFixtureItemIds.folder,
    inheritShares: false,
  },
  [RESOURCE_COMMAND_TYPE.setBlocksShareStatus]: {
    type: RESOURCE_COMMAND_TYPE.setBlocksShareStatus,
    noteId: commandFixtureItemIds.note,
    blockNoteIds: ['fixture_block'],
    status: 'all_shared',
  },
  [RESOURCE_COMMAND_TYPE.setBlockMemberPermission]: {
    type: RESOURCE_COMMAND_TYPE.setBlockMemberPermission,
    noteId: commandFixtureItemIds.note,
    blockNoteIds: ['fixture_block'],
    campaignMemberId: commandFixtureItemIds.member,
    permissionLevel: 'view',
  },
  [RESOURCE_COMMAND_TYPE.toggleBookmarks]: {
    type: RESOURCE_COMMAND_TYPE.toggleBookmarks,
    itemIds: [commandFixtureItemIds.source],
  },
} satisfies Record<ResourceCommand['type'], ResourceCommand>

export const fileSystemCommandReceiptEvents = {
  [RESOURCE_COMMAND_TYPE.create]: [
    { type: RESOURCE_EVENT_TYPE.created, itemId: commandFixtureItemIds.item, slug: 'created' },
  ],
  [RESOURCE_COMMAND_TYPE.rename]: [
    {
      type: RESOURCE_EVENT_TYPE.renamed,
      itemId: commandFixtureItemIds.item,
      slug: 'renamed',
      previousSlug: 'previous',
    },
  ],
  [RESOURCE_COMMAND_TYPE.move]: [
    { type: RESOURCE_EVENT_TYPE.moved, itemId: commandFixtureItemIds.source },
  ],
  [RESOURCE_COMMAND_TYPE.copy]: [
    {
      type: RESOURCE_EVENT_TYPE.copied,
      itemId: commandFixtureItemIds.item,
      sourceItemId: commandFixtureItemIds.source,
    },
  ],
  [RESOURCE_COMMAND_TYPE.trash]: [
    { type: RESOURCE_EVENT_TYPE.trashed, itemId: commandFixtureItemIds.source },
  ],
  [RESOURCE_COMMAND_TYPE.restore]: [
    { type: RESOURCE_EVENT_TYPE.restored, itemId: commandFixtureItemIds.source },
  ],
  [RESOURCE_COMMAND_TYPE.deleteForever]: [
    { type: RESOURCE_EVENT_TYPE.deletedForever, itemId: commandFixtureItemIds.source },
  ],
  [RESOURCE_COMMAND_TYPE.emptyTrash]: [
    { type: RESOURCE_EVENT_TYPE.deletedForever, itemId: commandFixtureItemIds.source },
  ],
  [RESOURCE_COMMAND_TYPE.setResourceAudiencePermission]: [
    { type: RESOURCE_EVENT_TYPE.updated, itemId: commandFixtureItemIds.source },
  ],
  [RESOURCE_COMMAND_TYPE.setResourcesMemberPermission]: [
    { type: RESOURCE_EVENT_TYPE.updated, itemId: commandFixtureItemIds.source },
  ],
  [RESOURCE_COMMAND_TYPE.clearResourcesMemberPermission]: [
    { type: RESOURCE_EVENT_TYPE.updated, itemId: commandFixtureItemIds.source },
  ],
  [RESOURCE_COMMAND_TYPE.setFolderInheritShares]: [
    { type: RESOURCE_EVENT_TYPE.updated, itemId: commandFixtureItemIds.folder },
  ],
  [RESOURCE_COMMAND_TYPE.setBlocksShareStatus]: [
    { type: RESOURCE_EVENT_TYPE.updated, itemId: commandFixtureItemIds.note },
  ],
  [RESOURCE_COMMAND_TYPE.setBlockMemberPermission]: [
    { type: RESOURCE_EVENT_TYPE.updated, itemId: commandFixtureItemIds.note },
  ],
  [RESOURCE_COMMAND_TYPE.toggleBookmarks]: [
    { type: RESOURCE_EVENT_TYPE.updated, itemId: commandFixtureItemIds.source },
  ],
} satisfies Record<ResourceCommand['type'], Array<ResourceEvent>>
