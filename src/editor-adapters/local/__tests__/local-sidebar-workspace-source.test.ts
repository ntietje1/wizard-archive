import type { WorkspaceRuntime } from '@wizard-archive/editor/runtime'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { createWizardEditorResource } from '@wizard-archive/editor/adapter'
import { act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vite-plus/test'
import { localWorkspaceReducer } from '../local-workspace-model'
import type { LocalWorkspaceAction, LocalWorkspaceState } from '../local-workspace-model'
import { SAMPLE_LOCAL_WORKSPACE } from '../sample-local-workspace'
import type { createLocalRuntimeFileSystem } from './helpers/local-runtime'
import { createLocalWorkspaceRuntime } from './helpers/local-runtime'
import type { WizardEditorItem, WizardEditorNavigationState } from '@wizard-archive/editor/adapter'
import type { Dispatch } from 'react'
import { testCampaignId } from 'shared/test/campaign-id'

const TEST_RESOURCE_TYPES = {
  notes: 'note',
} as const satisfies Record<string, WizardEditorItem['type']>
const TEST_PARENT_TARGET_KIND = {
  direct: 'direct',
} as const

function testResourceTitle(name: string): WizardEditorItem['name'] {
  if (name.trim().length === 0) throw new Error('Expected non-empty test resource name')
  return name as WizardEditorItem['name']
}

describe('local demo workspace runtime', () => {
  it('adapts the local filesystem catalog into the sidebar workspace source contract', () => {
    const { filesystem, setNavigation, source } = createLocalSidebarSource()

    expect(source.filesystem.catalog.getVisibleItems()).toEqual(
      filesystem.catalog.getVisibleItems(),
    )

    void source.navigation.openCreateDashboard()
    expect(source.filesystem.sharing.items.status).toBe('unsupported')
    expect(setNavigation).toHaveBeenCalledWith({ kind: 'create' })
  })

  it('renames items through the local filesystem operation', async () => {
    const { dispatch, source } = createLocalSidebarSource()
    const item = source.filesystem.catalog.getVisibleItems()[0]!

    await act(async () => {
      await source.filesystem.operations.updateItemMetadata({
        item,
        name: testResourceTitle('Renamed note'),
      })
    })

    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateItemMetadata',
      itemId: String(item.id),
      slug: 'renamed-note',
      title: 'Renamed note',
    })
  })

  it('rejects local rename commands when the target item is missing from the catalog', async () => {
    const { source } = createLocalSidebarSource()
    const item = source.filesystem.catalog.getVisibleItems()[0]!

    await expect(
      source.filesystem.operations.updateItemMetadata({
        item: { ...item, id: 'missing-local-item' as ResourceId },
        name: testResourceTitle('Renamed note'),
      }),
    ).rejects.toThrow('Failed to update item metadata')
  })

  it('keeps sidebar actions disabled through runtime read-only state in view-only mode', () => {
    const { source } = createLocalSidebarSource({ canEdit: false })

    expect(source.filesystem.permissions.canEdit).toBe(false)
  })

  it('keeps filesystem creation permission on the runtime', () => {
    const { source } = createLocalSidebarSource({
      filesystemOverrides: {
        permissions: {
          canCreateItems: false,
        },
      },
    })

    expect(source.filesystem.permissions.canCreateItems).toBe(false)
  })

  it('keeps local runtime instance identity separate from durable workspace identity', () => {
    const runtime = createLocalWorkspaceRuntime({
      dispatch: vi.fn(),
      runtimeInstanceId: 'demo-runtime-instance',
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })

    expect(runtime.workspace.id).toBe(SAMPLE_LOCAL_WORKSPACE.workspaceId)
    expect(runtime.workspace.instanceId).toBe('demo-runtime-instance')
  })

  it('opens items through local workspace selection instead of browser navigation', async () => {
    const { setNavigation, source } = createLocalSidebarSource()

    await act(async () => {
      await source.navigation.openItem(createWizardEditorResource('canvas-heist' as ResourceId))
    })

    expect(setNavigation).toHaveBeenCalledWith({
      kind: 'resource',
      resource: createWizardEditorResource('canvas-heist' as ResourceId),
    })
  })

  it('opens trash through local workspace state instead of browser navigation', async () => {
    const { setNavigation, source } = createLocalSidebarSource()

    await act(async () => {
      await source.navigation.openTrash()
    })

    expect(setNavigation).toHaveBeenCalledWith({ kind: 'trash' })
  })

  it('opens known trashed items from the trash surface', async () => {
    const workspace = localWorkspaceReducer(SAMPLE_LOCAL_WORKSPACE, {
      type: 'trashItems',
      itemIds: ['canvas-heist'],
    })
    const { setNavigation, source } = createLocalSidebarSource({
      navigation: { kind: 'trash' },
      workspace,
    })

    await act(async () => {
      await source.navigation.openItem(createWizardEditorResource('canvas-heist' as ResourceId))
    })

    expect(setNavigation).toHaveBeenCalledWith({
      kind: 'resource',
      resource: createWizardEditorResource('canvas-heist' as ResourceId),
    })
  })

  it('projects a known trashed current item instead of reporting it as missing', () => {
    const workspace = localWorkspaceReducer(SAMPLE_LOCAL_WORKSPACE, {
      type: 'trashItems',
      itemIds: ['canvas-heist'],
    })
    const { source } = createLocalSidebarSource({
      navigation: {
        kind: 'resource',
        resource: createWizardEditorResource('canvas-heist' as ResourceId),
      },
      workspace,
    })

    expect(source.filesystem.current.contentItem).toMatchObject({
      id: 'canvas-heist',
      isTrashed: true,
    })
    expect(source.filesystem.current.availabilityState).toMatchObject({
      status: 'trashed',
      label: 'Harbor Heist Board',
    })
  })

  it('routes creation through the local filesystem operation', async () => {
    const { dispatch, source } = createLocalSidebarSource()

    const created = await Promise.resolve(
      source.filesystem.operations.createItem({
        type: TEST_RESOURCE_TYPES.notes,
        parentTarget: { kind: TEST_PARENT_TARGET_KIND.direct, parentId: null },
        name: 'Local source note',
      }),
    )

    expect(created).toEqual({ status: 'completed', id: 'local-note-2', slug: 'local-note-2' })

    expect(dispatch).toHaveBeenCalledWith({
      type: 'createItem',
      creation: expect.objectContaining({
        id: 'local-note-2',
        item: expect.objectContaining({
          id: 'local-note-2',
          parentId: null,
          type: 'note',
        }),
      }),
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'updateItemMetadata',
      itemId: 'local-note-2',
      title: 'Local source note',
    })
  })

  it('routes local duplicate and trash commands through runtime filesystem operations', async () => {
    const dispatch = vi.fn()
    const source = createLocalWorkspaceRuntime({
      dispatch,
      workspace: SAMPLE_LOCAL_WORKSPACE,
    })
    const filesystem = source.filesystem
    const note = filesystem.catalog.getKnownItemById('note-market' as ResourceId)
    const canvas = filesystem.catalog.getKnownItemById('canvas-heist' as ResourceId)
    if (!note) throw new Error('Expected seeded note to exist in local demo catalog')
    if (!canvas) throw new Error('Expected seeded canvas to exist in local demo catalog')

    await source.filesystem.operations.executeDropCommand({
      type: 'copy',
      itemIds: [note.id],
      targetParentId: null,
    })
    await source.filesystem.operations.trashItems([canvas.id])

    expect(dispatch).toHaveBeenCalledWith({
      type: 'applyResourceCommandReceipt',
      receipt: expect.objectContaining({
        command: {
          type: 'copy',
          itemIds: ['note-market'],
          targetParentId: null,
        },
      }),
    })
    expect(dispatch).toHaveBeenCalledWith({
      type: 'applyResourceCommandReceipt',
      receipt: expect.objectContaining({
        command: {
          type: 'trash',
          itemIds: ['canvas-heist'],
        },
      }),
    })
  })

  it('routes local sidebar trash popover actions into runtime operations', async () => {
    const workspace = localWorkspaceReducer(SAMPLE_LOCAL_WORKSPACE, {
      type: 'trashItems',
      itemIds: ['canvas-heist'],
    })
    const deleteDispatch = vi.fn()
    const deleteSource = createLocalWorkspaceRuntime({
      dispatch: deleteDispatch,
      workspace,
    })

    await deleteSource.filesystem.operations.requestDeleteItemsForever([
      'canvas-heist' as ResourceId,
    ])

    expect(deleteDispatch).toHaveBeenCalledExactlyOnceWith({
      type: 'applyResourceCommandReceipt',
      receipt: expect.objectContaining({
        command: {
          type: 'deleteForever',
          itemIds: ['canvas-heist'],
        },
      }),
    })
    const deletedWorkspace = reduceLocalWorkspaceActions(workspace, deleteDispatch)

    const emptyTrashDispatch = vi.fn()
    const emptyTrashSource = createLocalWorkspaceRuntime({
      dispatch: emptyTrashDispatch,
      workspace: deletedWorkspace,
    })

    await emptyTrashSource.filesystem.operations.requestEmptyTrash()

    expect(emptyTrashDispatch).not.toHaveBeenCalled()
  })
})

function createLocalSidebarSource({
  canEdit = true,
  dispatch = vi.fn(),
  filesystemOverrides,
  navigation,
  setNavigation = vi.fn(),
  workspace = createTestLocalWorkspace(),
}: {
  canEdit?: boolean
  dispatch?: ReturnType<typeof vi.fn>
  filesystemOverrides?: {
    permissions?: Partial<ReturnType<typeof createLocalRuntimeFileSystem>['permissions']>
  }
  navigation?: WizardEditorNavigationState
  setNavigation?: ReturnType<typeof vi.fn>
  workspace?: LocalWorkspaceState
} = {}) {
  const resolvedDispatch = dispatch as Dispatch<LocalWorkspaceAction>
  const resolvedSetNavigation = setNavigation as (navigation: WizardEditorNavigationState) => void
  const runtime = createLocalWorkspaceRuntime({
    canEdit,
    dispatch: resolvedDispatch,
    navigation,
    setNavigation: resolvedSetNavigation,
    workspace,
  })
  const filesystem = runtime.filesystem
  const source: WorkspaceRuntime = {
    ...runtime,
    filesystem: {
      ...filesystem,
      permissions: {
        ...filesystem.permissions,
        ...filesystemOverrides?.permissions,
      },
    },
  }

  return { dispatch, filesystem, setNavigation, source }
}

let testWorkspaceIndex = 0

function createTestLocalWorkspace(): LocalWorkspaceState {
  testWorkspaceIndex += 1
  return {
    ...SAMPLE_LOCAL_WORKSPACE,
    workspaceId: testCampaignId(`local-test-${testWorkspaceIndex}`),
  }
}

function reduceLocalWorkspaceActions(
  workspace: LocalWorkspaceState,
  dispatch: ReturnType<typeof vi.fn>,
) {
  return dispatch.mock.calls.reduce(
    (state, [action]) => localWorkspaceReducer(state, action),
    workspace,
  )
}
