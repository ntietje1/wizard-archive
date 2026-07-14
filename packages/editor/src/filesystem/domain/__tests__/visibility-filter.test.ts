import { testResourceId } from '../../../../../../shared/test/resource-id'
import type { ResourceId } from '../../../resources/domain-id'
import { describe, expect, it } from 'vite-plus/test'

import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { createFolder, createNote } from '../../../test/sidebar-item-factory'
import { filterVisibleResourcesForActor } from '../visibility-filter'
import type { EditorWorkspaceActor } from '../permission-resolution'
import { createPermissionLookup } from './permission-test-utils'

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
        getItemById: createPermissionLookup(resources),
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
        getItemById: createPermissionLookup(resources),
      }),
    ).toEqual([visibleRoot])
  })
})

function resourceId(id: string): ResourceId {
  return testResourceId(id)
}
