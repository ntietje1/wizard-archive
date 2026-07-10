import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vite-plus/test'
import type { SidebarItemId } from '../../../../../../shared/common/ids'
import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { createFolder, createNote } from '../../../test/sidebar-item-factory'
import { testId } from '../../../test/id'
import type { AnyItem } from '../../../workspace/items'
import { filterVisibleResourcesForActor } from '../visibility-filter'
import type { EditorWorkspaceActor } from '../permission-resolution'

const ownerActor: EditorWorkspaceActor = { kind: 'owner' }
const participantActor: EditorWorkspaceActor = { kind: 'participant' }

describe('resource visibility filter domain', () => {
  it('keeps all resources visible to owners', () => {
    const visible = createNote({ id: resourceId('visible') })
    const hidden = createNote({
      id: resourceId('hidden'),
      myPermissionLevel: PERMISSION_LEVEL.NONE,
    })
    const resources = [visible, hidden]

    expect(
      filterVisibleResourcesForActor({
        resources,
        actor: ownerActor,
        getItemById: createLookup(resources),
      }),
    ).toBe(resources)
  })

  it('filters resources by actor permission and visible ancestors', () => {
    const hiddenFolder = createFolder({
      id: resourceId('hidden-folder'),
      myPermissionLevel: PERMISSION_LEVEL.NONE,
    })
    const visibleChild = createNote({
      id: resourceId('visible-child'),
      parentId: hiddenFolder.id,
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const visibleRoot = createNote({
      id: resourceId('visible-root'),
      myPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const resources = [hiddenFolder, visibleChild, visibleRoot]

    expect(
      filterVisibleResourcesForActor({
        resources,
        actor: participantActor,
        getItemById: createLookup(resources),
      }),
    ).toEqual([visibleRoot])
  })

  it('keeps visibility filtering out of access presentation', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), 'packages/editor/src/filesystem/access.ts'),
      'utf8',
    )

    expect(source).not.toContain('canViewResourceAndKnownAncestors')
  })
})

function resourceId(id: string): SidebarItemId {
  return testId<'sidebarItems'>(id)
}

function createLookup(items: Array<AnyItem>) {
  const itemsById = new Map<SidebarItemId, AnyItem>(items.map((item) => [item.id, item]))
  return (itemId: SidebarItemId) => itemsById.get(itemId) ?? null
}
