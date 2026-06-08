import { describe, expect, it } from 'vitest'
import { PERMISSION_LEVEL } from '../../shared/permissions/types'
import { getBlockSharePermissionLevelMigrationPatch } from '../blockShares/permissionLevelMigration'
import { getSidebarItemLifecycleMigrationPatch } from '../sidebarItems/lifecycleMigration'
import { getLegacyMediaBlockProjectionMigrationPatch } from '../../shared/editor-blocks/legacyMediaBlocks'

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

  describe('getLegacyMediaBlockProjectionMigrationPatch', () => {
    it('rewrites projected legacy media block rows to embed rows', () => {
      expect(
        getLegacyMediaBlockProjectionMigrationPatch({
          type: 'image',
          props: {
            url: 'https://example.com/a.png',
            name: 'a.png',
            previewWidth: 320,
          },
        }),
      ).toEqual({
        type: 'embed',
        props: {
          targetKind: 'externalUrl',
          url: 'https://example.com/a.png',
          name: 'a.png',
          previewWidth: 320,
        },
        content: null,
        inlineContent: null,
        plainText: '',
      })
    })

    it('leaves non-media projection rows alone', () => {
      expect(
        getLegacyMediaBlockProjectionMigrationPatch({ type: 'paragraph', props: {} }),
      ).toBeNull()
    })
  })
})
