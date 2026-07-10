import { describe, expect, it } from 'vitest'
import {
  PERMISSION_OPERATION,
  hasPermissionForOperation,
  hasPermissionForRequirement,
} from '../../../shared/permissions/requirements'
import {
  getBlockAllPlayersPermissionLevel,
  getEffectiveBlockVisibilityPermissionLevel,
} from '../../../shared/permissions/block-visibility'
import { SHARE_STATUS } from '../../../shared/block-shares/share-status'
import { hasAtLeastPermissionLevel } from '../../../shared/permissions/hasAtLeastPermissionLevel'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'

const { NONE, VIEW, EDIT, FULL_ACCESS } = PERMISSION_LEVEL

describe('hasAtLeastPermissionLevel', () => {
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

describe('hasPermissionForRequirement', () => {
  it('treats null or missing permission as NONE for requirements', () => {
    expect(hasPermissionForRequirement(null, NONE)).toBe(true)
    expect(hasPermissionForRequirement(undefined, VIEW)).toBe(false)
  })
})

describe('hasPermissionForOperation', () => {
  it('uses named operation requirements for sidebar operations', () => {
    expect(hasPermissionForOperation(EDIT, PERMISSION_OPERATION.READ_SIDEBAR_ITEM)).toBe(true)
    expect(hasPermissionForOperation(EDIT, PERMISSION_OPERATION.RENAME_SIDEBAR_ITEM)).toBe(true)
    expect(hasPermissionForOperation(VIEW, PERMISSION_OPERATION.RENAME_SIDEBAR_ITEM)).toBe(false)
    expect(hasPermissionForOperation(EDIT, PERMISSION_OPERATION.MOVE_SIDEBAR_ITEM)).toBe(false)
    expect(hasPermissionForOperation(FULL_ACCESS, PERMISSION_OPERATION.MOVE_SIDEBAR_ITEM)).toBe(
      true,
    )
    expect(
      hasPermissionForOperation(FULL_ACCESS, PERMISSION_OPERATION.DELETE_SIDEBAR_ITEM_FOREVER),
    ).toBe(true)
  })
})

describe('getBlockAllPlayersPermissionLevel', () => {
  it('normalizes block share status to hidden or visible all-player state', () => {
    expect(getBlockAllPlayersPermissionLevel(SHARE_STATUS.ALL_SHARED)).toBe(VIEW)
    expect(getBlockAllPlayersPermissionLevel(SHARE_STATUS.INDIVIDUALLY_SHARED)).toBe(NONE)
    expect(getBlockAllPlayersPermissionLevel(SHARE_STATUS.NOT_SHARED)).toBe(NONE)
    expect(getBlockAllPlayersPermissionLevel(null)).toBe(NONE)
  })
})

describe('getEffectiveBlockVisibilityPermissionLevel', () => {
  it('combines note access, all-player block visibility, and member overrides', () => {
    expect(
      getEffectiveBlockVisibilityPermissionLevel({
        isDm: true,
        notePermissionLevel: NONE,
        allPlayersPermissionLevel: NONE,
      }),
    ).toBe(EDIT)
    expect(
      getEffectiveBlockVisibilityPermissionLevel({
        isDm: false,
        notePermissionLevel: NONE,
        allPlayersPermissionLevel: VIEW,
      }),
    ).toBe(NONE)
    expect(
      getEffectiveBlockVisibilityPermissionLevel({
        isDm: false,
        notePermissionLevel: EDIT,
        allPlayersPermissionLevel: NONE,
      }),
    ).toBe(VIEW)
    expect(
      getEffectiveBlockVisibilityPermissionLevel({
        isDm: false,
        notePermissionLevel: VIEW,
        allPlayersPermissionLevel: VIEW,
        memberPermissionLevel: NONE,
      }),
    ).toBe(NONE)
  })
})
