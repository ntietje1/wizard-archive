import { describe, expect, it } from 'vitest'
import { PERMISSION_LEVEL } from '../../shared/permissions/types'
import { getBlockSharePermissionLevelMigrationPatch } from '../blockShares/permissionLevelMigration'
import { getDeleteBlockInlineContentProjectionFieldPatch } from '../blocks/inlineContentMigration'
import { getCampaignDefaultFolderInheritSharesMigrationPatch } from '../campaigns/defaultFolderInheritSharesMigration'
import { getEditHistoryBlockShareMemberMigrationPatch } from '../editHistory/blockShareMemberMigration'
import { getFolderInheritSharesMigrationPatch } from '../folders/inheritSharesMigration'
import { getFileSystemTransactionVocabularyMigrationPatch } from '../sidebarItems/filesystem/transactionVocabularyMigration'
import { getFileSystemSnapshotNormalizedNameMigrationPatch } from '../sidebarItems/filesystem/snapshotNormalizedNameMigration'
import { getSidebarItemLifecycleMigrationPatch } from '../sidebarItems/lifecycleMigration'
import { getSidebarItemNormalizedNameMigrationPatch } from '../sidebarItems/normalizedNameMigration'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'

describe('migrations', () => {
  describe('getSidebarItemLifecycleMigrationPatch', () => {
    it('marks existing sidebar rows as active', () => {
      expect(getSidebarItemLifecycleMigrationPatch({ location: 'sidebar' })).toEqual({
        location: 'sidebar',
        status: 'active',
      })
    })

    it('moves existing trash rows to sidebar location with trashed status', () => {
      expect(getSidebarItemLifecycleMigrationPatch({ location: 'trash' })).toEqual({
        location: 'sidebar',
        status: 'trashed',
      })
    })

    it('preserves already-migrated lifecycle state', () => {
      expect(
        getSidebarItemLifecycleMigrationPatch({
          location: 'sidebar',
          status: 'undoHidden',
        }),
      ).toBeNull()
    })
  })

  describe('getSidebarItemNormalizedNameMigrationPatch', () => {
    it('materializes the indexed comparison key', () => {
      expect(getSidebarItemNormalizedNameMigrationPatch({ name: '  The Guild  ' })).toEqual({
        normalizedName: 'the guild',
      })
    })

    it('preserves an up-to-date comparison key', () => {
      expect(
        getSidebarItemNormalizedNameMigrationPatch({
          name: 'The Guild',
          normalizedName: 'the guild',
        }),
      ).toBeUndefined()
    })
  })

  describe('getBlockSharePermissionLevelMigrationPatch', () => {
    it('defaults missing block share permission levels to view', () => {
      expect(getBlockSharePermissionLevelMigrationPatch({})).toEqual({
        permissionLevel: PERMISSION_LEVEL.VIEW,
      })
    })

    it('defaults null block share permission levels to view', () => {
      expect(getBlockSharePermissionLevelMigrationPatch({ permissionLevel: null })).toEqual({
        permissionLevel: PERMISSION_LEVEL.VIEW,
      })
    })

    it('preserves existing hidden block share permission levels', () => {
      expect(
        getBlockSharePermissionLevelMigrationPatch({ permissionLevel: PERMISSION_LEVEL.NONE }),
      ).toBeNull()
    })

    it('preserves existing visible block share permission levels', () => {
      expect(
        getBlockSharePermissionLevelMigrationPatch({ permissionLevel: PERMISSION_LEVEL.VIEW }),
      ).toBeNull()
    })
  })

  describe('getDeleteBlockInlineContentProjectionFieldPatch', () => {
    it('deletes the deprecated inlineContent projection field when present', () => {
      expect(getDeleteBlockInlineContentProjectionFieldPatch({ inlineContent: null })).toEqual({
        inlineContent: undefined,
      })
    })

    it('leaves already-clean projection rows alone', () => {
      expect(getDeleteBlockInlineContentProjectionFieldPatch({})).toBeNull()
    })
  })

  describe('getFolderInheritSharesMigrationPatch', () => {
    it('defaults existing folders with missing inheritShares to false', () => {
      expect(getFolderInheritSharesMigrationPatch({})).toEqual({ inheritShares: false })
    })

    it('preserves existing inheritShares values', () => {
      expect(getFolderInheritSharesMigrationPatch({ inheritShares: false })).toBeNull()
      expect(getFolderInheritSharesMigrationPatch({ inheritShares: true })).toBeNull()
    })
  })

  describe('getCampaignDefaultFolderInheritSharesMigrationPatch', () => {
    it('materializes missing campaign defaults as nullable legacy values', () => {
      expect(getCampaignDefaultFolderInheritSharesMigrationPatch({})).toEqual({
        defaultFolderInheritShares: null,
      })
    })

    it('preserves migrated nullable and boolean campaign defaults', () => {
      expect(
        getCampaignDefaultFolderInheritSharesMigrationPatch({
          defaultFolderInheritShares: null,
        }),
      ).toBeNull()
      expect(
        getCampaignDefaultFolderInheritSharesMigrationPatch({
          defaultFolderInheritShares: false,
        }),
      ).toBeNull()
      expect(
        getCampaignDefaultFolderInheritSharesMigrationPatch({
          defaultFolderInheritShares: true,
        }),
      ).toBeNull()
    })
  })

  describe('getEditHistoryBlockShareMemberMigrationPatch', () => {
    it('renames legacy member metadata in nested update changes', () => {
      expect(
        getEditHistoryBlockShareMemberMigrationPatch({
          action: EDIT_HISTORY_ACTION.updated,
          metadata: {
            changes: [
              {
                action: EDIT_HISTORY_ACTION.block_share_changed,
                metadata: { status: 'shared', campaignMemberId: 'member-1' },
              },
            ],
          },
        }),
      ).toEqual({
        metadata: {
          changes: [
            {
              action: EDIT_HISTORY_ACTION.block_share_changed,
              metadata: { status: 'shared', memberId: 'member-1' },
            },
          ],
        },
      })
    })
  })

  describe('getFileSystemTransactionVocabularyMigrationPatch', () => {
    it('renames legacy resource commands and every persisted change type', () => {
      expect(
        getFileSystemTransactionVocabularyMigrationPatch({
          command: { type: 'setAllPlayersPermission' },
          changes: [{ type: 'insertSidebarItem' }, { type: 'updateSidebarItemBookmarkState' }],
        }),
      ).toEqual({
        command: { type: 'setResourceAudiencePermission' },
        changes: [{ type: 'insertResource' }, { type: 'updateResourceBookmarkState' }],
      })
    })
  })

  describe('getFileSystemSnapshotNormalizedNameMigrationPatch', () => {
    it('normalizes every embedded resource snapshot in a transaction', () => {
      expect(
        getFileSystemSnapshotNormalizedNameMigrationPatch({
          changes: [
            {
              type: 'insertResource',
              after: { name: 'New Note' },
            },
            {
              type: 'updateResource',
              before: { name: 'Old Name' },
              after: { name: 'New Name' },
            },
            {
              type: 'removeResource',
              before: { name: 'Deleted Note' },
            },
          ],
        }),
      ).toEqual({
        changes: [
          {
            type: 'insertResource',
            after: { name: 'New Note', normalizedName: 'new note' },
          },
          {
            type: 'updateResource',
            before: { name: 'Old Name', normalizedName: 'old name' },
            after: { name: 'New Name', normalizedName: 'new name' },
          },
          {
            type: 'removeResource',
            before: { name: 'Deleted Note', normalizedName: 'deleted note' },
          },
        ],
      })
    })
  })
})
