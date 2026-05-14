import { describe, expect, it } from 'vitest'
import { normalizeRestoreTargetParentId } from '../targets'
import type { Id } from '../../../_generated/dataModel'

const folderId = 'folder' as Id<'sidebarItems'>

describe('sidebar operation targets', () => {
  it('normalizes missing restore targets to root', () => {
    expect(normalizeRestoreTargetParentId(folderId, null)).toBeNull()
    expect(normalizeRestoreTargetParentId(folderId, undefined)).toBeNull()
  })

  it('normalizes trashed restore targets to root', () => {
    expect(
      normalizeRestoreTargetParentId(folderId, {
        status: 'trashed',
      }),
    ).toBeNull()
  })

  it('preserves active restore targets', () => {
    expect(
      normalizeRestoreTargetParentId(folderId, {
        status: 'active',
      }),
    ).toBe(folderId)
  })

  it('treats non-trashed target objects as usable restore targets', () => {
    expect(normalizeRestoreTargetParentId(folderId, { status: 'unknown' as never })).toBe(folderId)
    expect(normalizeRestoreTargetParentId(folderId, {} as never)).toBe(folderId)
  })

  it('normalizes malformed non-object restore targets to root', () => {
    expect(normalizeRestoreTargetParentId(folderId, 'active' as never)).toBeNull()
  })
})
