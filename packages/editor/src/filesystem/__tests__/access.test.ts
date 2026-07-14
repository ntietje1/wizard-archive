import { describe, expect, it } from 'vite-plus/test'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import { RESOURCE_STATUS } from '../../workspace/items-persistence-contract'
import { createWorkspaceResourceReadModel } from '../../workspace/items'
import type { AnyItem } from '../../workspace/items'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { WORKSPACE_MODE } from '../../../../../shared/workspace/workspace-mode'
import {
  createActorFileSystemPermissions,
  filterFileSystemItemsForActor,
  resolveWorkspaceModeForItem,
} from '../access'
import { createFolder, createNote } from '../../test/sidebar-item-factory'
import { testId } from '../../test/id'
import { testResourceShareId } from '../../test/resource-share-id'

type FileSystemItemsReadState = Parameters<typeof filterFileSystemItemsForActor>[0]
type EditorWorkspaceActor = NonNullable<Parameters<typeof filterFileSystemItemsForActor>[1]>
type SidebarItemShare = AnyItem['shares'][number]

const memberId = testId<'campaignMembers'>('member_test')

const ownerActor: EditorWorkspaceActor = { kind: 'owner' }
const ownerViewAsActor: EditorWorkspaceActor = { kind: 'owner_view_as', participantId: memberId }
const participantActor: EditorWorkspaceActor = { kind: 'participant' }

function createShare(
  note: Pick<AnyItem, 'id' | 'campaignId' | 'type'>,
  id: string,
  permissionLevel: SidebarItemShare['permissionLevel'],
): SidebarItemShare {
  return {
    id: testResourceShareId(id),
    createdAt: 1,
    campaignId: note.campaignId,
    sidebarItemId: note.id,
    sidebarItemType: note.type,
    campaignMemberId: memberId,
    sessionId: null,
    permissionLevel,
  }
}

function buildItemLookup(items: Array<AnyItem>) {
  const map = new Map<SidebarItemId, AnyItem>()
  for (const item of items) map.set(item.id, item)
  return map.get.bind(map)
}

function createActorPermissions(actor: EditorWorkspaceActor | null, items: Array<AnyItem>) {
  return createActorFileSystemPermissions({
    actor,
    canEdit: true,
    canCreateItems: true,
    canEmptyTrash: true,
    canManageFolders: true,
    getItemById: buildItemLookup(items),
    setWorkspaceMode: () => undefined,
    workspaceMode: WORKSPACE_MODE.EDITOR,
  })
}

describe('actor filesystem permissions', () => {
  it('gives direct-message editors full access to items', () => {
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.NONE })
    const permissions = createActorPermissions(ownerActor, [note])

    expect(permissions.canAccessItem(note, PERMISSION_LEVEL.FULL_ACCESS)).toBe(true)
    expect(permissions.canMutateItem(note, PERMISSION_LEVEL.FULL_ACCESS)).toBe(true)
  })

  it('checks viewed player permission for direct-message view-as actors', () => {
    const note = createNote({
      shares: [],
      allPermissionLevel: null,
    })
    const permissions = createActorPermissions(ownerViewAsActor, [note])

    expect(permissions.canAccessItem(note, PERMISSION_LEVEL.VIEW)).toBe(false)
  })

  it('does not inherit view-as permission through folders with inheritShares disabled', () => {
    const folder = createFolder({
      id: testId<'sidebarItems'>('folder_parent'),
      inheritShares: false,
      allPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const note = createNote({
      parentId: folder.id,
      shares: [],
      allPermissionLevel: null,
    })
    const permissions = createActorPermissions(ownerViewAsActor, [folder, note])

    expect(permissions.canAccessItem(note, PERMISSION_LEVEL.VIEW)).toBe(false)
  })

  it('stops inherited view-as permission at the first folder with inheritShares disabled', () => {
    const grandparent = createFolder({
      id: testId<'sidebarItems'>('folder_grandparent'),
      inheritShares: true,
      allPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const parent = createFolder({
      id: testId<'sidebarItems'>('folder_parent_no_inherit'),
      parentId: grandparent.id,
      inheritShares: false,
      allPermissionLevel: null,
    })
    const note = createNote({
      parentId: parent.id,
      shares: [],
      allPermissionLevel: null,
    })
    const permissions = createActorPermissions(ownerViewAsActor, [grandparent, parent, note])

    expect(permissions.canAccessItem(note, PERMISSION_LEVEL.VIEW)).toBe(false)
  })

  it('exposes viewed-player permission while keeping direct-message view-as read-only', () => {
    const noteBase = createNote({
      myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    })
    const note = {
      ...noteBase,
      shares: [createShare(noteBase, 'share_edit', PERMISSION_LEVEL.EDIT)],
    }
    const permissions = createActorPermissions(ownerViewAsActor, [note])

    expect(permissions.canAccessItem(note, PERMISSION_LEVEL.EDIT)).toBe(true)
    expect(permissions.canAccessItem(note, PERMISSION_LEVEL.FULL_ACCESS)).toBe(false)
    expect(permissions.canMutateItem(note, PERMISSION_LEVEL.EDIT)).toBe(false)
    expect(permissions.getMemberItemPermissionLevel(note, memberId)).toBe(PERMISSION_LEVEL.EDIT)
  })

  it('treats nullable explicit member shares as view for direct-message view-as', () => {
    const note = createNote({ shares: [] })
    const noteWithNullableShare = {
      ...note,
      shares: [createShare(note, 'share_nullable_permission', null)],
    }
    const permissions = createActorPermissions(ownerViewAsActor, [noteWithNullableShare])

    expect(permissions.canAccessItem(noteWithNullableShare, PERMISSION_LEVEL.VIEW)).toBe(true)
    expect(permissions.canAccessItem(noteWithNullableShare, PERMISSION_LEVEL.EDIT)).toBe(false)
  })

  it('uses myPermissionLevel for regular players', () => {
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.EDIT })
    const permissions = createActorPermissions(participantActor, [note])

    expect(permissions.canAccessItem(note, PERMISSION_LEVEL.VIEW)).toBe(true)
    expect(permissions.canMutateItem(note, PERMISSION_LEVEL.EDIT)).toBe(true)
  })

  it('denies regular players when myPermissionLevel is insufficient', () => {
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.VIEW })
    const permissions = createActorPermissions(participantActor, [note])

    expect(permissions.canAccessItem(note, PERMISSION_LEVEL.EDIT)).toBe(false)
    expect(permissions.canMutateItem(note, PERMISSION_LEVEL.EDIT)).toBe(false)
  })
})

describe('filterFileSystemItemsForActor', () => {
  it('keeps the full active set for direct message actors', () => {
    const first = createNote({ id: noteId('visible') })
    const second = createNote({ id: noteId('hidden') })
    const active = createReadState([first, second])

    expect(filterFileSystemItemsForActor(active, ownerActor)).toBe(active)
  })

  it('filters active items through effective actor permissions', () => {
    const visible = createNote({
      id: noteId('visible'),
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const hidden = createNote({
      id: noteId('hidden'),
      myPermissionLevel: PERMISSION_LEVEL.NONE,
    })

    const filtered = filterFileSystemItemsForActor(
      createReadState([visible, hidden]),
      participantActor,
    )

    expect(filtered.data.map((item) => item.id)).toEqual([visible.id])
    expect(filtered.readModel.getItem(hidden.id)).toBeUndefined()
  })

  it('filters active descendants when a known parent is hidden from the actor', () => {
    const hiddenFolder = createFolder({
      id: noteId('hidden-folder'),
      myPermissionLevel: PERMISSION_LEVEL.NONE,
    })
    const visibleChild = createNote({
      id: noteId('visible-child'),
      parentId: hiddenFolder.id,
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })

    const filtered = filterFileSystemItemsForActor(
      createReadState([hiddenFolder, visibleChild]),
      participantActor,
    )

    expect(filtered.data).toEqual([])
    expect(filtered.readModel.getItem(visibleChild.id)).toBeUndefined()
  })

  it('fails closed when a visible ancestor chain contains a cycle', () => {
    const first = createFolder({
      id: noteId('cycle-first'),
      parentId: noteId('cycle-second'),
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const second = createFolder({
      id: noteId('cycle-second'),
      parentId: first.id,
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const filtered = filterFileSystemItemsForActor(
      createReadState([first, second]),
      participantActor,
    )

    expect(filtered.data).toEqual([])
  })
})

describe('resolveWorkspaceModeForItem', () => {
  it('keeps the requested workspace mode when the actor can edit the current item', () => {
    const note = createNote({ myPermissionLevel: PERMISSION_LEVEL.EDIT })

    expect(
      resolveWorkspaceModeForItem({
        actor: participantActor,
        currentItem: note,
        getItemById: buildItemLookup([note]),
        rawWorkspaceMode: WORKSPACE_MODE.EDITOR,
      }),
    ).toEqual({ canEdit: true, workspaceMode: WORKSPACE_MODE.EDITOR })
  })

  it('forces viewer mode for direct message view-as actors', () => {
    const noteBase = createNote()
    const note = {
      ...noteBase,
      shares: [createShare(noteBase, 'share_edit_for_view_as_mode', PERMISSION_LEVEL.EDIT)],
    }

    expect(
      resolveWorkspaceModeForItem({
        actor: ownerViewAsActor,
        currentItem: note,
        getItemById: buildItemLookup([note]),
        rawWorkspaceMode: WORKSPACE_MODE.EDITOR,
      }),
    ).toEqual({ canEdit: false, workspaceMode: WORKSPACE_MODE.VIEWER })
  })

  it('forces viewer mode for trashed current items', () => {
    const note = createNote({
      myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
      status: RESOURCE_STATUS.trashed,
    })

    expect(
      resolveWorkspaceModeForItem({
        actor: participantActor,
        currentItem: note,
        getItemById: buildItemLookup([note]),
        rawWorkspaceMode: WORKSPACE_MODE.EDITOR,
      }),
    ).toEqual({ canEdit: false, workspaceMode: WORKSPACE_MODE.VIEWER })
  })
})

function noteId(value: string) {
  return testId<'sidebarItems'>(value)
}

function createReadState(items: Array<AnyItem>): FileSystemItemsReadState {
  return {
    data: items,
    status: 'success',
    error: null,
    refresh: () => Promise.resolve(),
    readModel: createWorkspaceResourceReadModel(items),
  }
}
