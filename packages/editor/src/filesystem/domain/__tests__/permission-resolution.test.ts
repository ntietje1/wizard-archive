import { describe, expect, it } from 'vite-plus/test'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { createFolder, createNote } from '../../../test/sidebar-item-factory'
import { testId } from '../../../test/id'
import { testDomainId } from '../../../test/domain-id'
import { DOMAIN_ID_KIND } from '../../../resources/domain-id'
import type { AnyItem } from '../../../workspace/items'
import {
  actorCanMutateResource,
  actorHasResourcePermission,
  canViewResourceAndKnownAncestors,
  getMemberResourcePermissionLevel,
} from '../permission-resolution'
import type { EditorWorkspaceActor } from '../permission-resolution'
import { createPermissionLookup } from './permission-test-utils'

const memberId = testDomainId(DOMAIN_ID_KIND.campaignMember, 'permission_resolution_member')
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

  it('terminates inherited permission resolution on cyclic parent chains', () => {
    const firstId = testId<'sidebarItems'>('permission_cycle_first')
    const secondId = testId<'sidebarItems'>('permission_cycle_second')
    const first = createFolder({ id: firstId, parentId: secondId, inheritShares: true })
    const second = createFolder({ id: secondId, parentId: firstId, inheritShares: true })
    const note = createNote({ parentId: firstId, allPermissionLevel: null, shares: [] })

    expect(
      getMemberResourcePermissionLevel(
        note,
        memberId,
        createPermissionLookup([first, second, note]),
      ),
    ).toBe(PERMISSION_LEVEL.NONE)
  })

  it('skips non-folder ancestors while resolving inherited permission', () => {
    const ancestor = createNote({
      allPermissionLevel: PERMISSION_LEVEL.EDIT,
      parentId: null,
    })
    const note = createNote({ parentId: ancestor.id, allPermissionLevel: null, shares: [] })

    expect(
      getMemberResourcePermissionLevel(note, memberId, createPermissionLookup([ancestor, note])),
    ).toBe(PERMISSION_LEVEL.NONE)
  })
})

function createPermissionContext(actor: EditorWorkspaceActor | null, items: Array<AnyItem>) {
  return {
    actor,
    getItemById: createPermissionLookup(items),
  }
}
