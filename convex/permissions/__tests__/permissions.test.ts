import { describe, expect, it } from 'vitest'
import {
  PERMISSION_OPERATION,
  hasPermissionForOperation,
  hasPermissionForRequirement,
} from '../../../shared/permissions/requirements'
import { getBlockVisibilityPermissionLevel } from '../../../shared/permissions/block-visibility'
import { SHARE_STATUS } from '../../../shared/editor-blocks/share-status'
import { hasAtLeastPermissionLevel } from '../../../shared/permissions/hasAtLeastPermissionLevel'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'

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

  it('treats null or missing permission as NONE for requirements', () => {
    expect(hasPermissionForRequirement(null, NONE)).toBe(true)
    expect(hasPermissionForRequirement(undefined, VIEW)).toBe(false)
  })

  it('uses named operation requirements for sidebar operations', () => {
    expect(hasPermissionForOperation(EDIT, PERMISSION_OPERATION.READ_SIDEBAR_ITEM)).toBe(true)
    expect(hasPermissionForOperation(EDIT, PERMISSION_OPERATION.MOVE_SIDEBAR_ITEM)).toBe(false)
    expect(hasPermissionForOperation(FULL_ACCESS, PERMISSION_OPERATION.MOVE_SIDEBAR_ITEM)).toBe(
      true,
    )
    expect(
      hasPermissionForOperation(FULL_ACCESS, PERMISSION_OPERATION.DELETE_SIDEBAR_ITEM_FOREVER),
    ).toBe(true)
  })

  it('uses named block visibility outcomes', () => {
    expect(
      getBlockVisibilityPermissionLevel({
        isDm: true,
        shareStatus: SHARE_STATUS.NOT_SHARED,
      }),
    ).toBe(EDIT)
    expect(
      getBlockVisibilityPermissionLevel({
        isDm: false,
        shareStatus: SHARE_STATUS.ALL_SHARED,
      }),
    ).toBe(VIEW)
    expect(
      getBlockVisibilityPermissionLevel({
        isDm: false,
        shareStatus: SHARE_STATUS.INDIVIDUALLY_SHARED,
        isIndividuallySharedWithMember: true,
      }),
    ).toBe(VIEW)
    expect(
      getBlockVisibilityPermissionLevel({
        isDm: false,
        shareStatus: null,
      }),
    ).toBe(NONE)
  })
})
