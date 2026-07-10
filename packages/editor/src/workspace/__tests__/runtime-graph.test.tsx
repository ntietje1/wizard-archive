import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { WorkspaceRuntimeGraph } from '../runtime-graph'
import { createWorkspaceResource } from '../runtime'
import type { CurrentItemState, WorkspaceRuntime } from '../runtime'
import type { FileTopbarSource } from '../topbar/source'
import type { NoteItemWithContent } from '../../notes/item-contract'
import { RESOURCE_STATUS } from '../items-persistence-contract'
import { createNote } from '../../test/sidebar-item-factory'
import {
  createMemoryWorkspaceViewStateStores,
  createTestWorkspaceRuntime,
} from '../../test/workspace-runtime-factory'

const fileTopbarSpy = vi.hoisted(() => vi.fn())

vi.mock('../surface', () => ({
  WorkspaceSurface: ({
    banner,
    children,
    topbar,
  }: {
    banner: React.ReactNode
    children: React.ReactNode
    topbar: React.ReactNode
  }) => (
    <div>
      <div data-testid="graph-topbar">{topbar}</div>
      <div data-testid="graph-banner">{banner}</div>
      <div data-testid="graph-content">{children}</div>
    </div>
  ),
}))

vi.mock('../runtime-content', () => ({
  WorkspaceRuntimeContent: () => <div data-testid="workspace-content" />,
}))

vi.mock('../topbar/topbar', () => ({
  FileTopbar: (props: { source: FileTopbarSource }) => {
    fileTopbarSpy(props)
    return <div data-testid="file-topbar" />
  },
}))

vi.mock('../right-sidebar/container', () => ({
  RightSidebarContainer: () => <div data-testid="right-sidebar" />,
}))

vi.mock('../../filesystem/trash/banner', () => ({
  TrashBanner: ({ item }: { item: { name: string }; source: unknown }) => (
    <div data-testid="trash-banner">{item.name}</div>
  ),
}))

describe('WorkspaceRuntimeGraph', () => {
  beforeEach(() => {
    fileTopbarSpy.mockClear()
  })

  it('shows the trash banner for a trashed current item after availability resolves', () => {
    const item = createContentNote({ name: 'Deleted Note', status: RESOURCE_STATUS.trashed })

    render(
      <WorkspaceRuntimeGraph
        runtime={createRuntime({
          availabilityState: {
            status: 'available',
            label: item.name,
            item,
          },
          item,
        })}
        viewStateStores={createMemoryWorkspaceViewStateStores()}
      />,
    )

    expect(screen.getByTestId('trash-banner')).toHaveTextContent('Deleted Note')
  })

  it('wires topbar item navigation through the workspace navigation command', () => {
    const item = createContentNote({ name: 'Linked Note' })
    const openItem = vi.fn()
    const baseRuntime = createRuntime({
      availabilityState: {
        status: 'available',
        label: item.name,
        item,
      },
      item,
    })
    const runtime = {
      ...baseRuntime,
      navigation: {
        ...baseRuntime.navigation,
        openItem,
      },
    }

    render(
      <WorkspaceRuntimeGraph
        runtime={runtime}
        viewStateStores={createMemoryWorkspaceViewStateStores()}
      />,
    )

    const source = getLastFileTopbarSource()
    source.navigation.openItem(createWorkspaceResource(item.id))

    expect(openItem).toHaveBeenCalledWith(createWorkspaceResource(item.id))
  })
})

function getLastFileTopbarSource(): FileTopbarSource {
  const props = fileTopbarSpy.mock.calls.at(-1)?.[0]
  if (!props || typeof props !== 'object' || !('source' in props)) {
    throw new Error('Expected FileTopbar to receive a source')
  }
  return props.source
}

type WorkspaceRuntimeGraphRuntime = Parameters<typeof WorkspaceRuntimeGraph>[0]['runtime']

function createRuntime({
  availabilityState,
  item,
}: {
  availabilityState: CurrentItemState['availabilityState']
  item: ReturnType<typeof createNote> | NoteItemWithContent
}): WorkspaceRuntimeGraphRuntime {
  return createRuntimeGraphRuntime(
    createTestWorkspaceRuntime({
      activeItems: [item],
      availabilityState,
      item,
    }),
  )
}

function createRuntimeGraphRuntime(runtime: WorkspaceRuntime): WorkspaceRuntimeGraphRuntime {
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

function createContentNote(input: Parameters<typeof createNote>[0]): NoteItemWithContent {
  return {
    ...createNote(input),
    ancestors: [],
    blockMeta: {},
    blockShareAccessWarnings: [],
    content: [],
  }
}
