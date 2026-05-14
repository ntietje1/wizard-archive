import { describe, expect, it } from 'vitest'
import { getSidebarItemLifecycleMigrationPatch } from '../migrations'

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
})
