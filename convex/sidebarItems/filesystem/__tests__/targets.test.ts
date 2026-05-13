import { describe, expect, it } from 'vitest'
import { normalizeRestoreTargetParentId } from '../targets'
import type { Id } from '../../../_generated/dataModel'

const folderId = 'folder' as Id<'sidebarItems'>

describe('sidebar operation targets', () => {
  it('normalizes missing restore targets to root', () => {
    expect(normalizeRestoreTargetParentId(folderId, null)).toBeNull()
  })

  it('normalizes trashed restore targets to root', () => {
    expect(
      normalizeRestoreTargetParentId(folderId, {
        location: 'sidebar',
        status: 'trashed',
      }),
    ).toBeNull()
  })

  it('preserves active restore targets', () => {
    expect(
      normalizeRestoreTargetParentId(folderId, {
        location: 'sidebar',
        status: 'active',
      }),
    ).toBe(folderId)
  })
})
