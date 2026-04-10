import { describe, expect, it } from 'vitest'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import {
  effectiveHasAtLeastPermission,
  memberHasAtLeastPermission,
  resolvePermissionLevel,
} from '~/features/sharing/utils/permission-utils'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { createSidebarItemShare } from '~/test/factories/share-factory'
import { testId } from '~/test/helpers/test-id'

const memberId = testId<'campaignMembers'>('member_test')
const otherMemberId = testId<'campaignMembers'>('member_other')

function buildMap(items: Array<AnySidebarItem>) {
  const map = new Map<SidebarItemId, AnySidebarItem>()
  for (const item of items) map.set(item._id, item)
  return map
}

describe('resolvePermissionLevel', () => {
  it('returns member-specific share when present', () => {
    const share = createSidebarItemShare({
      campaignMemberId: memberId,
      permissionLevel: PERMISSION_LEVEL.EDIT,
    })
    const note = createNote({ shares: [share] })
    const result = resolvePermissionLevel(note, memberId, buildMap([note]))
    expect(result.level).toBe(PERMISSION_LEVEL.EDIT)
  })

  it('defaults to VIEW when member share has null permissionLevel', () => {
    const share = createSidebarItemShare({
      campaignMemberId: memberId,
      permissionLevel: null,
    })
    const note = createNote({ shares: [share] })
    const result = resolvePermissionLevel(note, memberId, buildMap([note]))
    expect(result.level).toBe(PERMISSION_LEVEL.VIEW)
  })

  it('falls back to allPermissionLevel when no member share', () => {
    const note = createNote({
      shares: [],
      allPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const result = resolvePermissionLevel(note, memberId, buildMap([note]))
    expect(result.level).toBe(PERMISSION_LEVEL.VIEW)
  })

  it('walks parent chain to find inherited permission', () => {
    const parentFolder = createFolder({
      _id: testId<'sidebarItems'>('folder_parent'),
      name: 'Parent',
      parentId: null,
      inheritShares: true,
      allPermissionLevel: PERMISSION_LEVEL.EDIT,
    })
    const note = createNote({
      parentId: parentFolder._id,
      shares: [],
      allPermissionLevel: null,
    })
    const map = buildMap([parentFolder, note])
    const result = resolvePermissionLevel(note, memberId, map)
    expect(result.level).toBe(PERMISSION_LEVEL.EDIT)
    expect(result.source).toBe('Parent')
  })

  it('walks multiple levels of parent chain', () => {
    const grandparent = createFolder({
      _id: testId<'sidebarItems'>('folder_gp'),
      name: 'Grandparent',
      parentId: null,
      inheritShares: true,
      allPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const parent = createFolder({
      _id: testId<'sidebarItems'>('folder_p'),
      name: 'Parent',
      parentId: grandparent._id,
      inheritShares: true,
      allPermissionLevel: null,
      shares: [],
    })
    const note = createNote({
      parentId: parent._id,
      shares: [],
      allPermissionLevel: null,
    })
    const map = buildMap([grandparent, parent, note])
    const result = resolvePermissionLevel(note, memberId, map)
    expect(result.level).toBe(PERMISSION_LEVEL.VIEW)
    expect(result.source).toBe('Grandparent')
  })

  it('respects inheritShares: false — skips that folder but continues walking', () => {
    const grandparent = createFolder({
      _id: testId<'sidebarItems'>('folder_gp2'),
      name: 'Grandparent',
      parentId: null,
      inheritShares: true,
      allPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const parent = createFolder({
      _id: testId<'sidebarItems'>('folder_p2'),
      name: 'Parent',
      parentId: grandparent._id,
      inheritShares: false,
      allPermissionLevel: PERMISSION_LEVEL.EDIT,
      shares: [],
    })
    const note = createNote({
      parentId: parent._id,
      shares: [],
      allPermissionLevel: null,
    })
    const map = buildMap([grandparent, parent, note])
    const result = resolvePermissionLevel(note, memberId, map)
    expect(result.level).toBe(PERMISSION_LEVEL.VIEW)
    expect(result.source).toBe('Grandparent')
  })

  it('returns NONE when nothing found', () => {
    const note = createNote({
      shares: [],
      allPermissionLevel: null,
      parentId: null,
    })
    const result = resolvePermissionLevel(note, memberId, buildMap([note]))
    expect(result.level).toBe(PERMISSION_LEVEL.NONE)
  })

  it('prefers member share on parent folder over allPermissionLevel', () => {
    const parentShare = createSidebarItemShare({
      campaignMemberId: memberId,
      permissionLevel: PERMISSION_LEVEL.EDIT,
    })
    const parentFolder = createFolder({
      _id: testId<'sidebarItems'>('folder_pref'),
      name: 'Parent',
      parentId: null,
      inheritShares: true,
      allPermissionLevel: PERMISSION_LEVEL.VIEW,
      shares: [parentShare],
    })
    const note = createNote({
      parentId: parentFolder._id,
      shares: [],
      allPermissionLevel: null,
    })
    const map = buildMap([parentFolder, note])
    const result = resolvePermissionLevel(note, memberId, map)
    expect(result.level).toBe(PERMISSION_LEVEL.EDIT)
  })

  it('ignores shares for other members', () => {
    const share = createSidebarItemShare({
      campaignMemberId: otherMemberId,
      permissionLevel: PERMISSION_LEVEL.EDIT,
    })
    const note = createNote({ shares: [share], allPermissionLevel: null })
    const result = resolvePermissionLevel(note, memberId, buildMap([note]))
    expect(result.level).toBe(PERMISSION_LEVEL.NONE)
  })
})

describe('memberHasAtLeastPermission', () => {
  it('returns true when resolved level meets requirement', () => {
    const note = createNote({ allPermissionLevel: PERMISSION_LEVEL.EDIT })
    expect(
      memberHasAtLeastPermission(note, memberId, buildMap([note]), PERMISSION_LEVEL.VIEW),
    ).toBe(true)
  })

  it('returns false when resolved level is below requirement', () => {
    const note = createNote({ allPermissionLevel: PERMISSION_LEVEL.VIEW })
    expect(
      memberHasAtLeastPermission(note, memberId, buildMap([note]), PERMISSION_LEVEL.EDIT),
    ).toBe(false)
  })

  it('returns true for equal levels', () => {
    const note = createNote({ allPermissionLevel: PERMISSION_LEVEL.VIEW })
    expect(
      memberHasAtLeastPermission(note, memberId, buildMap([note]), PERMISSION_LEVEL.VIEW),
    ).toBe(true)
  })
})

describe('effectiveHasAtLeastPermission', () => {
  it('DM without view-as always has permission', () => {
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.NONE })
    expect(
      effectiveHasAtLeastPermission(note, PERMISSION_LEVEL.FULL_ACCESS, {
        isDm: true,
        viewAsPlayerId: null,
        allItemsMap: buildMap([note]),
      }),
    ).toBe(true)
  })

  it('DM with view-as checks viewed player permission', () => {
    const note = createNote({
      shares: [],
      allPermissionLevel: null,
    })
    expect(
      effectiveHasAtLeastPermission(note, PERMISSION_LEVEL.VIEW, {
        isDm: true,
        viewAsPlayerId: memberId,
        allItemsMap: buildMap([note]),
      }),
    ).toBe(false)
  })

  it('regular player uses myPermissionLevel', () => {
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.EDIT })
    expect(
      effectiveHasAtLeastPermission(note, PERMISSION_LEVEL.VIEW, {
        isDm: false,
        viewAsPlayerId: null,
        allItemsMap: buildMap([note]),
      }),
    ).toBe(true)
  })

  it('regular player denied when myPermissionLevel is insufficient', () => {
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.VIEW })
    expect(
      effectiveHasAtLeastPermission(note, PERMISSION_LEVEL.EDIT, {
        isDm: false,
        viewAsPlayerId: null,
        allItemsMap: buildMap([note]),
      }),
    ).toBe(false)
  })
})
