import { describe, expect, it } from 'vitest'
import { PERMISSION_LEVEL } from 'shared/permissions/types'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { CampaignActor } from 'shared/campaigns/actor'
import {
  actorCanMutateSidebarItem,
  effectiveHasAtLeastPermission,
  getActorActionPermissionLevel,
  getActorPermissionLevel,
} from '~/features/sharing/utils/permission-utils'
import { createFolder, createNote } from '~/test/factories/sidebar-item-factory'
import { testId } from '~/test/helpers/test-id'

const memberId = testId<'campaignMembers'>('member_test')
const campaignId = testId<'campaigns'>('campaign_test')

const dmActor: CampaignActor = { kind: 'dm', campaignId }
const dmViewAsActor: CampaignActor = { kind: 'dm_view_as', campaignId, memberId }
const playerActor: CampaignActor = { kind: 'player', campaignId }

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
        actor: dmActor,
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
        actor: dmViewAsActor,
        allItemsMap: buildMap([note]),
      }),
    ).toBe(false)
  })

  it('DM with view-as does not inherit player permission through folders with inheritShares disabled', () => {
    const folder = createFolder({
      _id: testId<'sidebarItems'>('folder_parent'),
      inheritShares: false,
      allPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const note = createNote({
      parentId: folder._id,
      shares: [],
      allPermissionLevel: null,
    })

    expect(
      effectiveHasAtLeastPermission(note, PERMISSION_LEVEL.VIEW, {
        actor: dmViewAsActor,
        allItemsMap: buildMap([folder, note]),
      }),
    ).toBe(false)
  })

  it('exposes viewed-player permission while keeping DM view-as read-only for mutations', () => {
    const note = createNote({
      myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
      shares: [
        {
          _id: testId<'sidebarItemShares'>('share_edit'),
          _creationTime: 1,
          campaignId,
          sidebarItemId: testId<'sidebarItems'>('note_shared'),
          sidebarItemType: SIDEBAR_ITEM_TYPES.notes,
          campaignMemberId: memberId,
          sessionId: null,
          permissionLevel: PERMISSION_LEVEL.EDIT,
        },
      ],
    })
    const allItemsMap = buildMap([note])
    const context = { actor: dmViewAsActor, allItemsMap }

    expect(getActorPermissionLevel(note, context)).toBe(PERMISSION_LEVEL.EDIT)
    expect(getActorActionPermissionLevel(note, context)).toBe(PERMISSION_LEVEL.VIEW)
    expect(actorCanMutateSidebarItem(note, PERMISSION_LEVEL.EDIT, context)).toBe(false)
  })

  it('DM with view-as treats nullable explicit member shares as view', () => {
    const note = createNote({ shares: [] })
    const noteWithNullableShare = {
      ...note,
      shares: [
        {
          _id: testId<'sidebarItemShares'>('share_nullable_permission'),
          _creationTime: 1,
          campaignId: note.campaignId,
          sidebarItemId: note._id,
          sidebarItemType: note.type,
          campaignMemberId: memberId,
          sessionId: null,
          permissionLevel: null,
        },
      ],
    }

    expect(
      effectiveHasAtLeastPermission(noteWithNullableShare, PERMISSION_LEVEL.VIEW, {
        actor: dmViewAsActor,
        allItemsMap: buildMap([noteWithNullableShare]),
      }),
    ).toBe(true)
    expect(
      effectiveHasAtLeastPermission(noteWithNullableShare, PERMISSION_LEVEL.EDIT, {
        actor: dmViewAsActor,
        allItemsMap: buildMap([noteWithNullableShare]),
      }),
    ).toBe(false)
  })

  it('regular player uses myPermissionLevel', () => {
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.EDIT })
    expect(
      effectiveHasAtLeastPermission(note, PERMISSION_LEVEL.VIEW, {
        actor: playerActor,
        allItemsMap: buildMap([note]),
      }),
    ).toBe(true)
  })

  it('regular player denied when myPermissionLevel is insufficient', () => {
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.VIEW })
    expect(
      effectiveHasAtLeastPermission(note, PERMISSION_LEVEL.EDIT, {
        actor: playerActor,
        allItemsMap: buildMap([note]),
      }),
    ).toBe(false)
  })
})
