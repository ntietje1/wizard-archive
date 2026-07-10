import { describe, expect, it } from 'vitest'
import { hasAtLeastPermissionLevel } from 'shared/permissions/hasAtLeastPermissionLevel'
import { PERMISSION_LEVEL } from 'shared/permissions/types'

describe('hasAtLeastPermissionLevel', () => {
  const { NONE, VIEW, EDIT, FULL_ACCESS } = PERMISSION_LEVEL

  it('treats every level as at least itself', () => {
    for (const level of [NONE, VIEW, EDIT, FULL_ACCESS]) {
      expect(hasAtLeastPermissionLevel(level, level)).toBe(true)
    }
  })

  it('orders permission levels by rank', () => {
    expect(hasAtLeastPermissionLevel(FULL_ACCESS, EDIT)).toBe(true)
    expect(hasAtLeastPermissionLevel(EDIT, VIEW)).toBe(true)
    expect(hasAtLeastPermissionLevel(VIEW, EDIT)).toBe(false)
    expect(hasAtLeastPermissionLevel(NONE, VIEW)).toBe(false)
  })
})
