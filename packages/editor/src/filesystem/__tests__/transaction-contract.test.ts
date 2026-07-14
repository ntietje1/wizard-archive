import type { ResourceId } from '../../resources/domain-id'
import { describe, expect, it } from 'vite-plus/test'

import { canonicalizeResourceItemTitle } from '../../workspace/items'
import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import {
  RESOURCE_COMMAND_TYPE,
  RESOURCE_EVENT_TYPE,
  isResourceCatalogCommand,
  isResourceSharingCommand,
  summarizeResourceReceipt,
} from '../transaction-contract'
import type { ResourceCommand } from '../transaction-contract'
import {
  commandFixtureItemIds,
  fileSystemCommandFixtures,
  fileSystemCommandReceiptEvents,
} from './command-fixtures'

const sourceItemId = 'source' as ResourceId
const itemId = 'item' as ResourceId

describe('summarizeResourceReceipt', () => {
  it('classifies catalog-backed commands in the package command contract', () => {
    const catalogCommandTypes = new Set<ResourceCommand['type']>([
      RESOURCE_COMMAND_TYPE.move,
      RESOURCE_COMMAND_TYPE.copy,
      RESOURCE_COMMAND_TYPE.trash,
      RESOURCE_COMMAND_TYPE.restore,
      RESOURCE_COMMAND_TYPE.deleteForever,
      RESOURCE_COMMAND_TYPE.emptyTrash,
      RESOURCE_COMMAND_TYPE.toggleBookmarks,
    ])

    for (const command of Object.values(fileSystemCommandFixtures)) {
      expect(isResourceCatalogCommand(command)).toBe(catalogCommandTypes.has(command.type))
    }
  })

  it('classifies sharing commands in the package command contract', () => {
    const sharingCommandTypes = new Set<ResourceCommand['type']>([
      RESOURCE_COMMAND_TYPE.setResourceAudiencePermission,
      RESOURCE_COMMAND_TYPE.setResourcesMemberPermission,
      RESOURCE_COMMAND_TYPE.clearResourcesMemberPermission,
      RESOURCE_COMMAND_TYPE.setFolderInheritShares,
      RESOURCE_COMMAND_TYPE.setBlocksShareStatus,
      RESOURCE_COMMAND_TYPE.setBlockMemberPermission,
    ])

    for (const command of Object.values(fileSystemCommandFixtures)) {
      expect(isResourceSharingCommand(command)).toBe(sharingCommandTypes.has(command.type))
    }
  })

  it('has receipt summary coverage for every filesystem command type', () => {
    expect(Object.keys(fileSystemCommandFixtures).sort()).toEqual(
      Object.values(RESOURCE_COMMAND_TYPE).sort(),
    )
    expect(Object.keys(fileSystemCommandReceiptEvents).sort()).toEqual(
      Object.values(RESOURCE_COMMAND_TYPE).sort(),
    )

    for (const commandType of Object.values(RESOURCE_COMMAND_TYPE)) {
      const summary = summarizeResourceReceipt(
        fileSystemCommandFixtures[commandType],
        fileSystemCommandReceiptEvents[commandType],
      )

      expect(summary.kind).not.toBe('noop')
      expect(summary.affectedCount).toBeGreaterThan(0)
    }
  })

  it('treats empty event receipts as no-ops instead of requested action summaries', () => {
    const commands = [
      {
        type: RESOURCE_COMMAND_TYPE.create,
        resourceId: commandFixtureItemIds.created,
        itemType: RESOURCE_TYPES.notes,
        name: canonicalizeResourceItemTitle('New note'),
        parentTarget: { kind: 'direct', parentId: null },
      },
      {
        type: RESOURCE_COMMAND_TYPE.move,
        itemIds: [sourceItemId],
        targetParentId: null,
      },
      {
        type: RESOURCE_COMMAND_TYPE.setResourceAudiencePermission,
        itemIds: [sourceItemId],
        permissionLevel: null,
      },
    ] satisfies ReadonlyArray<ResourceCommand>

    expect(commands.map((command) => summarizeResourceReceipt(command, []))).toEqual([
      expect.objectContaining({ kind: 'noop', affectedCount: 0 }),
      expect.objectContaining({ kind: 'noop', affectedCount: 0 }),
      expect.objectContaining({ kind: 'noop', affectedCount: 0 }),
    ])
  })

  it('reports metadata-only edits as item updates instead of renames', () => {
    expect(
      summarizeResourceReceipt(
        {
          type: RESOURCE_COMMAND_TYPE.rename,
          itemId,
          iconName: null,
        },
        [{ type: RESOURCE_EVENT_TYPE.updated, itemId }],
      ).kind,
    ).toBe('updated')

    expect(
      summarizeResourceReceipt(
        {
          type: RESOURCE_COMMAND_TYPE.rename,
          itemId,
          name: canonicalizeResourceItemTitle('New name'),
        },
        [
          {
            type: RESOURCE_EVENT_TYPE.renamed,
            itemId,
            slug: 'new-name',
            previousSlug: 'old-name',
          },
        ],
      ).kind,
    ).toBe('renamed')
  })

  it('counts restored roots without treating conflict renames as extra restored items', () => {
    expect(
      summarizeResourceReceipt(
        {
          type: RESOURCE_COMMAND_TYPE.restore,
          itemIds: [sourceItemId],
          targetParentId: null,
        },
        [
          {
            type: RESOURCE_EVENT_TYPE.renamed,
            itemId: sourceItemId,
            slug: 'meeting-notes-2',
            previousSlug: 'meeting-notes',
          },
          {
            type: RESOURCE_EVENT_TYPE.restored,
            itemId: sourceItemId,
          },
        ],
      ).affectedCount,
    ).toBe(1)
  })
})
