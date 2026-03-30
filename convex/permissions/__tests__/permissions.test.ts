import { describe, expect, it } from 'vitest'
import { hasAtLeastPermissionLevel } from '../hasAtLeastPermissionLevel'
import { PERMISSION_LEVEL } from '../types'

describe('hasAtLeastPermissionLevel', () => {
  const { NONE, VIEW, EDIT, FULL_ACCESS } = PERMISSION_LEVEL

  it('every level is at least itself', () => {
    for (const level of [NONE, VIEW, EDIT, FULL_ACCESS]) {
      expect(hasAtLeastPermissionLevel(level, level)).toBe(true)
    }
  })

  it('FULL_ACCESS >= all levels', () => {
    expect(hasAtLeastPermissionLevel(FULL_ACCESS, NONE)).toBe(true)
    expect(hasAtLeastPermissionLevel(FULL_ACCESS, VIEW)).toBe(true)
    expect(hasAtLeastPermissionLevel(FULL_ACCESS, EDIT)).toBe(true)
    expect(hasAtLeastPermissionLevel(FULL_ACCESS, FULL_ACCESS)).toBe(true)
  })

  it('NONE >= only NONE', () => {
    expect(hasAtLeastPermissionLevel(NONE, NONE)).toBe(true)
    expect(hasAtLeastPermissionLevel(NONE, VIEW)).toBe(false)
    expect(hasAtLeastPermissionLevel(NONE, EDIT)).toBe(false)
    expect(hasAtLeastPermissionLevel(NONE, FULL_ACCESS)).toBe(false)
  })

  it('VIEW < EDIT', () => {
    expect(hasAtLeastPermissionLevel(VIEW, EDIT)).toBe(false)
  })

  it('EDIT < FULL_ACCESS', () => {
    expect(hasAtLeastPermissionLevel(EDIT, FULL_ACCESS)).toBe(false)
  })

  it('EDIT >= VIEW', () => {
    expect(hasAtLeastPermissionLevel(EDIT, VIEW)).toBe(true)
  })

  it('VIEW >= NONE', () => {
    expect(hasAtLeastPermissionLevel(VIEW, NONE)).toBe(true)
  })
})
