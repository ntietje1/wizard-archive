import { describe, expect, it, vi } from 'vite-plus/test'

import { PERMISSION_LEVEL } from '../../../../../../shared/permissions/types'
import { createTestWorkspaceRuntime } from '../../../test/workspace-runtime-factory'
import { createNote } from '../../../test/sidebar-item-factory'
import { createRuntimeSidebarTreeSource } from '../create-runtime-sidebar-tree-source'

describe('createRuntimeSidebarTreeSource', () => {
  it('allows root drops when the workspace can create root items but no editable item is open', () => {
    const runtime = createTestWorkspaceRuntime({
      canCreateItems: true,
      canEdit: true,
      canMutateItem: () => true,
      currentNavigation: { kind: 'trash' },
    })

    const source = createRuntimeSidebarTreeSource({
      ...runtime,
      sidebarSelection: {
        getSelectionSnapshot: vi.fn(() => ({
          activeItemSurface: null,
          anchorItemId: null,
          focusedItemId: null,
          selectedItemIds: [],
        })),
      },
    })

    expect(source.canDropOnRoot).toBe(true)
  })

  it('allows target item menus when no editable item is open', () => {
    const note = createNote()
    const runtime = createTestWorkspaceRuntime({
      activeItems: [note],
      canEdit: false,
      currentNavigation: { kind: 'empty' },
      canAccessItem: (item, requiredLevel) =>
        item.id === note.id && requiredLevel === PERMISSION_LEVEL.VIEW,
    })

    const source = createRuntimeSidebarTreeSource({
      ...runtime,
      sidebarSelection: {
        getSelectionSnapshot: vi.fn(() => ({
          activeItemSurface: null,
          anchorItemId: null,
          focusedItemId: null,
          selectedItemIds: [],
        })),
      },
    })

    expect(source.item.canUseItemActions(note)).toBe(true)
  })
})
