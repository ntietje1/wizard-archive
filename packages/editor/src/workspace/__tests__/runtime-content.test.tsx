import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { WorkspaceRuntimeContent } from '../runtime-content'
import type { CurrentItemState, WorkspaceNavigationState, WorkspaceRuntime } from '../runtime'
import { DndProviderContext } from '../../drag-drop/context'
import { dropTargetChromeClass } from '@wizard-archive/ui/drag-drop/drop-target-visual-state'
import type { FileSystemOperations } from '../../filesystem/operations'
import type { NoteItemWithContent } from '../../notes/item-contract'
import { createNote } from '../../test/sidebar-item-factory'
import {
  createMemoryWorkspaceViewStateStores,
  createTestWorkspaceRuntime,
} from '../../test/workspace-runtime-factory'

const dropTargetState = vi.hoisted(() => ({
  isFileDropTarget: false,
  isSidebarItemDropTarget: false,
  useDndDropTarget: vi.fn(),
  useExternalDropTarget: vi.fn(),
}))

const SidebarItemContentSpy = vi.hoisted(() => vi.fn())

vi.mock('../../drag-drop/use-drop-target', () => ({
  useDndDropTarget: dropTargetState.useDndDropTarget,
}))

vi.mock('../../drag-drop/use-external-drop-target', () => ({
  useExternalDropTarget: dropTargetState.useExternalDropTarget,
}))

vi.mock('../context-menu/context-menu', () => ({
  WorkspaceContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@wizard-archive/ui/components/loading-spinner', () => ({
  LoadingSpinner: () => <div data-testid="workspace-loading-spinner" />,
}))

vi.mock('../sidebar/viewer/content', () => ({
  SidebarItemContent: (props: {
    item: { name: string }
    runtime: unknown
    viewStateStores: unknown
  }) => {
    SidebarItemContentSpy(props)
    return <div data-testid="sidebar-item-content">{props.item.name}</div>
  },
}))

vi.mock('../../filesystem/create-new-dashboard', () => ({
  CreateNewDashboard: () => <div data-testid="create-new-dashboard" />,
}))

vi.mock('../../filesystem/trash/page-viewer', () => ({
  TrashPageViewer: ({ source }: { source: unknown }) => (
    <div data-testid="trash-page-viewer" data-has-source={String(Boolean(source))} />
  ),
}))

describe('WorkspaceRuntimeContent', () => {
  beforeEach(() => {
    SidebarItemContentSpy.mockReset()
    dropTargetState.isFileDropTarget = false
    dropTargetState.isSidebarItemDropTarget = false
    dropTargetState.useDndDropTarget.mockReset()
    dropTargetState.useDndDropTarget.mockImplementation(() => ({
      dropTargetRef: vi.fn(),
      dropTargetKey: 'empty-editor',
      isDropTarget: dropTargetState.isSidebarItemDropTarget,
    }))
    dropTargetState.useExternalDropTarget.mockReset()
    dropTargetState.useExternalDropTarget.mockImplementation(() => ({
      externalDropTargetRef: vi.fn(),
      isFileDropTarget: dropTargetState.isFileDropTarget,
    }))
  })

  it('registers the editable empty workspace as the runtime-backed drop zone', () => {
    renderWorkspaceRuntimeContent(createEmptyWorkspaceRuntime({ canEdit: true }), {
      withDndProvider: true,
    })

    expect(screen.getByTestId('empty-workspace-drop-zone')).toHaveTextContent(
      'Select an item from the sidebar to view it.',
    )
    expect(dropTargetState.useDndDropTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        canDrop: true,
        data: { type: 'empty-editor' },
      }),
    )
    expect(dropTargetState.useExternalDropTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { type: 'empty-editor' },
        enabled: false,
        fileDropTarget: expect.objectContaining({ kind: 'accepted' }),
      }),
    )
  })

  it('accepts empty workspace file drops only when create permission is available', () => {
    renderWorkspaceRuntimeContent(
      createEmptyWorkspaceRuntime({
        canCreateItems: true,
        canEdit: true,
      }),
      {
        withDndProvider: true,
      },
    )

    expect(screen.getByTestId('empty-workspace-drop-zone')).toHaveTextContent(
      'Select an item from the sidebar to view it.',
    )
    expect(dropTargetState.useDndDropTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        canDrop: true,
      }),
    )
    expect(dropTargetState.useExternalDropTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        fileDropTarget: expect.objectContaining({ kind: 'accepted' }),
      }),
    )
  })

  it('renders the create dashboard only when selection targets the create surface', () => {
    renderWorkspaceRuntimeContent(
      createEmptyWorkspaceRuntime({
        canEdit: true,
        currentNavigation: { kind: 'create' },
        isDm: true,
      }),
    )

    expect(screen.getByTestId('create-new-dashboard')).toBeInTheDocument()
  })

  it('uses provider capabilities when configuring external file drops', () => {
    renderWorkspaceRuntimeContent(createEmptyWorkspaceRuntime({ canEdit: true }), {
      canAcceptExternalFiles: false,
      withDndProvider: true,
    })

    expect(screen.getByTestId('empty-workspace-drop-zone')).toBeInTheDocument()
    expect(dropTargetState.useDndDropTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        canDrop: true,
      }),
    )
    expect(dropTargetState.useExternalDropTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        fileDropTarget: expect.objectContaining({ kind: 'accepted' }),
      }),
    )
  })

  it('uses runtime permissions when configuring empty workspace drops', () => {
    renderWorkspaceRuntimeContent(createEmptyWorkspaceRuntime({ canEdit: false }), {
      withDndProvider: true,
    })

    expect(screen.getByText('Select an item from the sidebar to view it.')).toBeInTheDocument()
    expect(dropTargetState.useDndDropTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        canDrop: false,
      }),
    )
    expect(dropTargetState.useExternalDropTarget).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        fileDropTarget: expect.objectContaining({ kind: 'accepted' }),
      }),
    )
  })

  it('highlights the empty workspace for active sidebar item drops', () => {
    dropTargetState.isSidebarItemDropTarget = true

    renderWorkspaceRuntimeContent(createEmptyWorkspaceRuntime({ canEdit: true }), {
      withDndProvider: true,
    })

    expect(screen.getByTestId('empty-workspace-drop-zone').className).toContain(
      dropTargetChromeClass('default'),
    )
  })

  it('highlights the empty workspace for active external file drops', () => {
    dropTargetState.isSidebarItemDropTarget = true
    dropTargetState.isFileDropTarget = true

    renderWorkspaceRuntimeContent(
      createEmptyWorkspaceRuntime({
        canCreateItems: true,
        canEdit: true,
      }),
      {
        withDndProvider: true,
      },
    )

    expect(screen.getByTestId('empty-workspace-drop-zone').className).toContain(
      dropTargetChromeClass('file'),
    )
    expect(screen.getByTestId('empty-workspace-drop-zone').className).not.toContain(
      dropTargetChromeClass('default'),
    )
  })

  it('renders missing pages from availability state', () => {
    renderWorkspaceRuntimeContent(
      createEmptyWorkspaceRuntime({
        availabilityState: {
          status: 'not_found',
          label: 'Page',
          message: 'Page not found.',
        },
        canEdit: true,
        currentNavigation: { kind: 'resource', resourceId: null },
        isDm: true,
      }),
    )

    expect(screen.getByText('Page not found.')).toBeInTheDocument()
  })

  it('renders the loading state before availability decisions', () => {
    const note = createNote({ name: 'Loading Note' })

    renderWorkspaceRuntimeContent(
      createRuntimeContentRuntime(
        createTestWorkspaceRuntime({
          availabilityState: {
            status: 'loading',
            label: note.name,
          },
          currentNavigation: { kind: 'resource', resourceId: note.id },
          item: note,
        }),
      ),
    )

    expect(screen.getByTestId('workspace-loading-spinner')).toBeInTheDocument()
  })

  it('renders the trash view for an empty trash current view', () => {
    renderWorkspaceRuntimeContent(
      createEmptyWorkspaceRuntime({ canEdit: true, currentNavigation: { kind: 'trash' } }),
    )

    expect(screen.getByTestId('trash-page-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('trash-page-viewer')).toHaveAttribute('data-has-source', 'true')
  })

  it('renders unavailable item content from availability state', () => {
    renderWorkspaceRuntimeContent(
      createEmptyWorkspaceRuntime({
        availabilityState: {
          status: 'not_shared',
          label: 'Secret Page',
          message: 'This page is not shared with you.',
        },
        canEdit: true,
        currentNavigation: { kind: 'resource', resourceId: null },
      }),
    )

    expect(screen.getByText('This page is not shared with you.')).toBeInTheDocument()
  })

  it('renders unavailable content for inaccessible selected items outside item navigation', () => {
    const note = createNote({ name: 'Secret Trash Note' })

    renderWorkspaceRuntimeContent(
      createRuntimeContentRuntime(
        createTestWorkspaceRuntime({
          availabilityState: {
            status: 'not_shared',
            label: note.name,
            message: 'This trashed page is not shared with you.',
          },
          currentNavigation: { kind: 'trash' },
          item: note,
        }),
      ),
    )

    expect(screen.getByText('This trashed page is not shared with you.')).toBeInTheDocument()
    expect(
      screen.queryByText('Select an item from the sidebar to view it.'),
    ).not.toBeInTheDocument()
  })

  it('renders available item content from availability state', async () => {
    const note = createContentNote('Available Note')

    renderWorkspaceRuntimeContent(
      createRuntimeContentRuntime(
        createTestWorkspaceRuntime({
          availabilityState: {
            status: 'available',
            label: note.name,
            item: note,
          },
          contentItem: note,
          item: note,
        }),
      ),
    )

    expect(await screen.findByTestId('sidebar-item-content')).toHaveTextContent('Available Note')
    expect(SidebarItemContentSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        item: note,
        viewStateStores: expect.objectContaining({
          canvasViewport: expect.any(Object),
          mapTransform: expect.any(Object),
          noteScroll: expect.any(Object),
        }),
      }),
    )
  })
})

type WorkspaceRuntimeContentRuntime = Parameters<typeof WorkspaceRuntimeContent>[0]['runtime']

function createContentNote(name: string): NoteItemWithContent {
  return {
    ...createNote({ name }),
    ancestors: [],
    blockMeta: {},
    blockShareAccessWarnings: [],
    content: [],
  }
}

function createEmptyWorkspaceRuntime({
  availabilityState = {
    status: 'not_found' as const,
    label: 'Page',
    message: 'Page not found.',
  },
  canCreateItems,
  canEdit,
  currentNavigation = { kind: 'empty' },
  isDm = false,
  operations,
}: {
  availabilityState?: Exclude<CurrentItemState['availabilityState'], { status: 'available' }>
  canCreateItems?: boolean
  canEdit: boolean
  currentNavigation?: WorkspaceNavigationState
  isDm?: boolean
  operations?: Partial<FileSystemOperations>
}): WorkspaceRuntimeContentRuntime {
  return createRuntimeContentRuntime(
    createTestWorkspaceRuntime({
      availabilityState,
      canEdit,
      canCreateItems: canCreateItems ?? isDm,
      canEmptyTrash: isDm,
      canManageFolders: isDm,
      currentNavigation,
      workspaceMode: canEdit ? 'editor' : 'viewer',
      operations,
    }),
  )
}

function createRuntimeContentRuntime(runtime: WorkspaceRuntime): WorkspaceRuntimeContentRuntime {
  const { filesystem, navigation, sessions } = runtime
  return {
    filesystem: {
      catalog: filesystem.catalog,
      current: filesystem.current,
      history: filesystem.history,
      load: filesystem.load,
      operationItems: filesystem.operationItems,
      operations: filesystem.operations,
      paths: filesystem.paths,
      permissions: filesystem.permissions,
      sharing: filesystem.sharing,
    },
    navigation: {
      current: navigation.current,
      openCreateDashboard: navigation.openCreateDashboard,
      openExternalUrl: navigation.openExternalUrl,
      openItem: navigation.openItem,
      openTrash: navigation.openTrash,
    },
    sessions,
  }
}

function renderWorkspaceRuntimeContent(
  runtime: WorkspaceRuntimeContentRuntime,
  {
    canAcceptExternalFiles = true,
    withDndProvider = false,
  }: { canAcceptExternalFiles?: boolean; withDndProvider?: boolean } = {},
) {
  const content = (
    <WorkspaceRuntimeContent
      runtime={runtime}
      viewStateStores={createMemoryWorkspaceViewStateStores()}
    />
  )

  if (!withDndProvider) {
    return render(content)
  }

  return render(
    <DndProviderContext.Provider
      value={{
        canAcceptExternalFiles,
        dispatchDropPayload: () => Promise.resolve(),
        getItemLinkPath: (item) => [item.name],
        runtimeId: 'test-runtime',
      }}
    >
      {content}
    </DndProviderContext.Provider>,
  )
}
