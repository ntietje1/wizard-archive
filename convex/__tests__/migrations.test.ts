import { describe, expect, it } from 'vitest'
import { PERMISSION_LEVEL } from '../../shared/permissions/types'
import { getBlockSharePermissionLevelMigrationPatch } from '../blockShares/permissionLevelMigration'
import { getSidebarItemLifecycleMigrationPatch } from '../sidebarItems/lifecycleMigration'
import { getLegacyBlockProjectionMigrationPatch } from '../../shared/editor-blocks/legacyMediaBlocks'

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

  describe('getLegacyBlockProjectionMigrationPatch', () => {
    it('rewrites projected legacy media block rows to embed rows', () => {
      expect(
        getLegacyBlockProjectionMigrationPatch({
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

    it('normalizes legacy table projection rows', () => {
      expect(
        getLegacyBlockProjectionMigrationPatch({
          type: 'table',
          props: { textColor: 'default' },
          inlineContent: {
            type: 'tableContent',
            columnWidths: [120],
            rows: [
              {
                cells: [[{ type: 'text', text: 'Cell value', styles: {} }]],
              },
            ],
          },
        }),
      ).toEqual({
        content: {
          type: 'tableContent',
          columnWidths: [120],
          rows: [
            {
              cells: [
                {
                  type: 'tableCell',
                  content: [{ type: 'text', text: 'Cell value', styles: {} }],
                },
              ],
            },
          ],
        },
        inlineContent: null,
      })
    })

    it('strips legacy embed preview height and clears projection content', () => {
      expect(
        getLegacyBlockProjectionMigrationPatch({
          type: 'embed',
          props: { targetKind: 'empty', previewWidth: 320, previewHeight: 180 },
          inlineContent: [],
        }),
      ).toEqual({
        props: { targetKind: 'empty', previewWidth: 320 },
        content: null,
        inlineContent: null,
      })
    })

    it('backfills missing inline block content from inlineContent', () => {
      expect(
        getLegacyBlockProjectionMigrationPatch({
          type: 'paragraph',
          props: {},
          inlineContent: [{ type: 'text', text: 'Hello', styles: {} }],
        }),
      ).toEqual({
        content: [{ type: 'text', text: 'Hello', styles: {} }],
      })
    })

    it('leaves already-normalized projection rows alone', () => {
      expect(
        getLegacyBlockProjectionMigrationPatch({
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: 'Hello', styles: {} }],
          inlineContent: [{ type: 'text', text: 'Hello', styles: {} }],
        }),
      ).toBeNull()
    })
  })
})
