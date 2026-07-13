import { describe, expect, it } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { createFolder, createNote } from '../../../test/sidebar-item-factory'
import { testId } from '../../../test/id'
import type { AnyItem } from '../../../workspace/items'
import {
  actorCanMutateResource,
  actorHasResourcePermission,
  canViewResourceAndKnownAncestors,
  getMemberResourcePermissionLevel,
} from '../permission-resolution'
import type { EditorWorkspaceActor } from '../permission-resolution'

const memberId = testId<'campaignMembers'>('permission_resolution_member')
const ownerActor: EditorWorkspaceActor = { kind: 'owner' }
const participantActor: EditorWorkspaceActor = { kind: 'participant' }
const ownerViewAsActor: EditorWorkspaceActor = {
  kind: 'owner_view_as',
  participantId: memberId,
}

describe('permission resolution domain', () => {
  it('gives owners full access and mutation authority', () => {
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.NONE })
    const ctx = createPermissionContext(ownerActor, [note])

    expect(actorHasResourcePermission(note, PERMISSION_LEVEL.FULL_ACCESS, ctx)).toBe(true)
    expect(actorCanMutateResource(note, PERMISSION_LEVEL.FULL_ACCESS, ctx)).toBe(true)
  })

  it('uses participant item permission levels', () => {
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.VIEW })
    const ctx = createPermissionContext(participantActor, [note])

    expect(actorHasResourcePermission(note, PERMISSION_LEVEL.VIEW, ctx)).toBe(true)
    expect(actorHasResourcePermission(note, PERMISSION_LEVEL.EDIT, ctx)).toBe(false)
    expect(actorCanMutateResource(note, PERMISSION_LEVEL.EDIT, ctx)).toBe(false)
  })

  it('resolves owner view-as permission from inherited folder shares without mutation', () => {
    const folder = createFolder({
      id: testId<'sidebarItems'>('permission_resolution_folder'),
      inheritShares: true,
      allPermissionLevel: PERMISSION_LEVEL.EDIT,
    })
    const note = createNote({
      parentId: folder.id,
      allPermissionLevel: null,
      shares: [],
    })
    const ctx = createPermissionContext(ownerViewAsActor, [folder, note])

    expect(actorHasResourcePermission(note, PERMISSION_LEVEL.EDIT, ctx)).toBe(true)
    expect(actorCanMutateResource(note, PERMISSION_LEVEL.VIEW, ctx)).toBe(false)
    expect(getMemberResourcePermissionLevel(note, memberId, ctx.getItemById)).toBe(
      PERMISSION_LEVEL.EDIT,
    )
  })

  it('requires visible ancestor chains', () => {
    const folder = createFolder({
      id: testId<'sidebarItems'>('permission_resolution_hidden_folder'),
      myPermissionLevel: PERMISSION_LEVEL.NONE,
    })
    const note = createNote({
      parentId: folder.id,
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const ctx = createPermissionContext(participantActor, [folder, note])

    expect(canViewResourceAndKnownAncestors(note, ctx)).toBe(false)
  })
})

function createPermissionContext(actor: EditorWorkspaceActor | null, items: Array<AnyItem>) {
  return {
    actor,
    getItemById: createLookup(items),
  }
}

function createLookup(items: Array<AnyItem>) {
  const itemsById = new Map<SidebarItemId, AnyItem>(items.map((item) => [item.id, item]))
  return (itemId: SidebarItemId) => itemsById.get(itemId) ?? null
}
