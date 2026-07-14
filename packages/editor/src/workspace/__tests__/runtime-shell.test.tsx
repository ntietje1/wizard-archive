import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { RIGHT_SIDEBAR_CONTENT } from '../right-sidebar/content'
import type { WorkspaceRuntime } from '../runtime'
import { createRuntimeRightSidebarSource } from '../right-sidebar/runtime-source'
import { WorkspaceRuntimeShell } from '../runtime-shell'
import { useWorkspaceRuntime, WorkspaceRuntimeProvider } from '../runtime-context'
import { useEmbeddedCanvasState } from '../../canvas/embedded-canvas-state-context'
import { useResourceContentState } from '../../filesystem/resource-content-context'
import { createNote } from '../../test/sidebar-item-factory'
import { isResourceItemWithContent } from '../../workspace/items'
import {
  createMemoryWorkspaceViewStateStores,
  createTestWorkspaceRuntime,
} from '../../test/workspace-runtime-factory'
import { testResourceId } from '../../../../../shared/test/resource-id'

type WorkspaceRuntimeShellRightSidebar = NonNullable<
  ComponentProps<typeof WorkspaceRuntimeShell>['rightSidebar']
>

const editorWorkspaceGraphMock = vi.fn()

vi.mock('../runtime-graph', () => ({
  WorkspaceRuntimeGraph: (props: unknown) => {
    editorWorkspaceGraphMock(props)
    return <div data-testid="workspace-runtime-graph" />
  },
}))

describe('WorkspaceRuntimeShell', () => {
  beforeEach(() => {
    editorWorkspaceGraphMock.mockClear()
  })

  it('composes the supplied sidebar and editor graph in the workspace region', () => {
    const rightSidebar = createRightSidebar()

    render(
      <RuntimeShellHarness
        runtime={workspaceRuntimeWithCurrentItem('item-a')}
        rightSidebar={rightSidebar}
        sidebar={<div data-testid="supplied-sidebar" />}
        viewStateStores={createMemoryWorkspaceViewStateStores()}
      />,
    )

    const workspace = screen.getByLabelText('Editor workspace')
    expect(workspace).toBeInTheDocument()
    expect(screen.getByTestId('supplied-sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('workspace-runtime-graph')).toBeInTheDocument()
    expect(workspace).toContainElement(screen.getByTestId('supplied-sidebar'))
    expect(workspace).toContainElement(screen.getByTestId('workspace-runtime-graph'))
    expect(editorWorkspaceGraphMock).toHaveBeenCalledWith(
      expect.objectContaining({
        rightSidebar,
        runtime: expect.objectContaining({
          filesystem: expect.objectContaining({
            current: expect.objectContaining({
              item: expect.objectContaining({ id: testResourceId('item-a') }),
            }),
          }),
        }),
        viewStateStores: expect.objectContaining({
          canvasViewport: expect.any(Object),
          mapTransform: expect.any(Object),
          noteScroll: expect.any(Object),
        }),
      }),
    )
  })

  it('closes the right sidebar when the current item changes', () => {
    const rightSidebar = createRightSidebar()

    const { rerender } = render(
      <RuntimeShellHarness
        runtime={workspaceRuntimeWithCurrentItem('item-a')}
        rightSidebar={rightSidebar}
        sidebar={null}
        viewStateStores={createMemoryWorkspaceViewStateStores()}
      />,
    )

    rerender(
      <RuntimeShellHarness
        runtime={workspaceRuntimeWithCurrentItem('item-a')}
        rightSidebar={rightSidebar}
        sidebar={null}
        viewStateStores={createMemoryWorkspaceViewStateStores()}
      />,
    )

    rerender(
      <RuntimeShellHarness
        runtime={workspaceRuntimeWithCurrentItem('item-b')}
        rightSidebar={rightSidebar}
        sidebar={null}
        viewStateStores={createMemoryWorkspaceViewStateStores()}
      />,
    )

    expect(rightSidebar.state.close).toHaveBeenCalledTimes(1)
  })

  it('provides the workspace runtime to sidebar content', () => {
    render(
      <RuntimeShellHarness
        runtime={workspaceRuntimeWithCurrentItem('item-a')}
        sidebar={<RuntimeReadingSidebar />}
        viewStateStores={createMemoryWorkspaceViewStateStores()}
      />,
    )

    expect(screen.getByTestId('runtime-current-item')).toHaveTextContent(testResourceId('item-a'))
  })

  it('provides resource content and embedded canvas state from separate runtime sources', () => {
    const runtime = workspaceRuntimeWithCurrentItem('item-a')
    const embeddedCanvasState = {
      status: 'available' as const,
      nodes: [],
      edges: [],
    }
    const useEmbeddedCanvasStateFromRuntime = vi.fn(() => embeddedCanvasState)
    runtime.sessions.canvasEmbedded.embeddedCanvas.useEmbeddedCanvasState =
      useEmbeddedCanvasStateFromRuntime

    render(
      <RuntimeShellHarness
        runtime={runtime}
        sidebar={<WorkspaceSourceProbe />}
        viewStateStores={createMemoryWorkspaceViewStateStores()}
      />,
    )

    expect(screen.getByTestId('resource-content-state')).toHaveTextContent('ready')
    expect(screen.getByTestId('embedded-canvas-state')).toHaveTextContent('available')
    expect(useEmbeddedCanvasStateFromRuntime).toHaveBeenCalledWith(testResourceId('canvas-a'))
  })

  it('keeps provider children mounted when runtime source functions change', () => {
    const onUnmount = vi.fn()
    const firstRuntime = workspaceRuntimeWithCurrentItem('item-a')
    firstRuntime.sessions.canvasEmbedded.embeddedCanvas.useEmbeddedCanvasState = vi.fn(() => ({
      status: 'loading' as const,
    }))
    const secondRuntime = workspaceRuntimeWithCurrentItem('item-a')
    secondRuntime.sessions.canvasEmbedded.embeddedCanvas.useEmbeddedCanvasState = vi.fn(() => ({
      status: 'available' as const,
      nodes: [],
      edges: [],
    }))

    const { rerender } = render(
      <RuntimeShellHarness
        runtime={firstRuntime}
        sidebar={<MountedWorkspaceSourceProbe onUnmount={onUnmount} />}
        viewStateStores={createMemoryWorkspaceViewStateStores()}
      />,
    )

    rerender(
      <RuntimeShellHarness
        runtime={secondRuntime}
        sidebar={<MountedWorkspaceSourceProbe onUnmount={onUnmount} />}
        viewStateStores={createMemoryWorkspaceViewStateStores()}
      />,
    )

    expect(screen.getByTestId('embedded-canvas-state')).toHaveTextContent('available')
    expect(onUnmount).not.toHaveBeenCalled()
  })
})

function RuntimeReadingSidebar() {
  const runtime = useWorkspaceRuntime()
  return <div data-testid="runtime-current-item">{runtime.filesystem.current.item?.id}</div>
}

function RuntimeShellHarness({
  runtime,
  ...props
}: ComponentProps<typeof WorkspaceRuntimeShell> & { runtime: WorkspaceRuntime }) {
  return (
    <WorkspaceRuntimeProvider value={runtime}>
      <WorkspaceRuntimeShell {...props} />
    </WorkspaceRuntimeProvider>
  )
}

function WorkspaceSourceProbe() {
  const resourceContentState = useResourceContentState(testResourceId('item-a'), 'Item A')
  const embeddedCanvasState = useEmbeddedCanvasState(testResourceId('canvas-a'))

  return (
    <>
      <div data-testid="resource-content-state">{resourceContentState.status}</div>
      <div data-testid="embedded-canvas-state">{embeddedCanvasState.status}</div>
    </>
  )
}

function MountedWorkspaceSourceProbe({ onUnmount }: { onUnmount: () => void }) {
  useEffect(() => onUnmount, [onUnmount])
  return <WorkspaceSourceProbe />
}

function createRightSidebar(): WorkspaceRuntimeShellRightSidebar {
  return {
    source: createRuntimeRightSidebarSource(createTestWorkspaceRuntime({}), {
      navigateToHeading: vi.fn(),
    }),
    state: {
      activeContentId: RIGHT_SIDEBAR_CONTENT.outline,
      close: vi.fn(),
      isLoaded: true,
      open: vi.fn(),
      setActiveContent: vi.fn(),
      setSize: vi.fn(),
      setVisible: vi.fn(),
      size: 320,
      toggle: vi.fn(),
      visible: true,
    },
  }
}

function workspaceRuntimeWithCurrentItem(itemId: string): WorkspaceRuntime {
  const item = {
    ...createNote({
      id: testResourceId(itemId),
      name: itemId,
    }),
    ancestors: [],
    blockMeta: {},
    blockShareAccessWarnings: [],
    content: [],
  }

  if (!isResourceItemWithContent(item)) {
    throw new Error('Workspace runtime test item must include loaded resource content')
  }

  return createTestWorkspaceRuntime({
    activeItems: [item],
    item,
  })
}
