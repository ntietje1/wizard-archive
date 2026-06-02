import { describe, expect, it } from 'vitest'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'

const memberId = testId<'campaignMembers'>('member_test')

function buildMap(items: Array<AnySidebarItem>) {
  const map = new Map<Id<'sidebarItems'>, AnySidebarItem>()
  for (const item of items) map.set(item._id, item)
  return map
}

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

  it('DM with view-as inherits player permission from ancestors', () => {
    const folder = createFolder({
      _id: testId<'sidebarItems'>('folder_parent'),
      inheritShares: true,
      allPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const note = createNote({
      parentId: folder._id,
      shares: [],
      allPermissionLevel: null,
    })

    expect(
      effectiveHasAtLeastPermission(note, PERMISSION_LEVEL.VIEW, {
        isDm: true,
        viewAsPlayerId: memberId,
        allItemsMap: buildMap([folder, note]),
      }),
    ).toBe(true)
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
