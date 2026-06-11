import { describe, expect, it } from 'vitest'
import { PERMISSION_LEVEL } from '../../shared/permissions/types'
import { getBlockSharePermissionLevelMigrationPatch } from '../blockShares/permissionLevelMigration'
import { getDeleteBlockInlineContentProjectionFieldPatch } from '../blocks/inlineContentMigration'
import { getFolderInheritSharesMigrationPatch } from '../folders/inheritSharesMigration'
import { getSidebarItemLifecycleMigrationPatch } from '../sidebarItems/lifecycleMigration'

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
})
