import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { createNote } from '../../test/sidebar-item-factory'
import { RESOURCE_TYPES } from '../items-persistence-contract'
import type { NoteItemWithContent } from '../../notes/item-contract'
import {
  createMemoryWorkspaceViewStateStores,
  createTestWorkspaceRuntime,
} from '../../test/workspace-runtime-factory'
import { WorkspaceRuntimeHost } from '../runtime-host'
import type { WorkspaceRuntime } from '../runtime'
import { useWorkspaceRuntime } from '../runtime-context'
import type { CampaignMemberId } from '../../../../../shared/common/ids'

const shellSpy = vi.hoisted(() => vi.fn())
const searchDialogSpy = vi.hoisted(() => vi.fn())
const dndSpy = vi.hoisted(() => vi.fn())
const sidebarContentSpy = vi.hoisted(() => vi.fn())
const useNoteHeadingScrollRequestSpy = vi.hoisted(() => vi.fn())
const rightSidebarSource = vi.hoisted(() => ({
  current: {
    history: { status: 'unavailable' },
    itemLinks: { status: 'unsupported' },
    navigation: { openItem: vi.fn() },
    outline: { getOutlineState: vi.fn(), navigateToHeading: vi.fn() },
    resolveItem: vi.fn(),
  },
}))
const rightSidebarState = vi.hoisted(() => ({
  activeContentId: 'outline',
  close: vi.fn(),
  isLoaded: true,
  open: vi.fn(),
  setActiveContent: vi.fn(),
  setSize: vi.fn(),
  setVisible: vi.fn(),
  size: 320,
  toggle: vi.fn(),
  visible: true,
}))
const leftSidebarState = vi.hoisted(() => ({
  isLoaded: true,
  setSize: vi.fn(),
  setVisible: vi.fn(),
  size: 280,
  visible: true,
}))

vi.mock('@wizard-archive/ui/components/resizable-sidebar', () => ({
  ResizableSidebar: ({
    children,
    side,
    size,
    visible,
  }: {
    children: ReactNode
    side: string
    size: number
    visible: boolean
  }) => (
    <aside data-testid={`${side}-resizable-sidebar`} data-size={size} data-visible={visible}>
      {children}
    </aside>
  ),
}))

vi.mock('@wizard-archive/ui/components/banner', () => ({
  Banner: ({ actions, children }: { actions?: ReactNode; children: ReactNode }) => (
    <output>
      {children}
      {actions}
    </output>
  ),
  BannerButton: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}))

vi.mock('@wizard-archive/ui/shadcn/components/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: ReactNode }) => <>{placeholder}</>,
}))

vi.mock('@wizard-archive/ui/panel-preferences/use-panel-preference', () => ({
  usePanelPreference: () => leftSidebarState,
}))

vi.mock('../right-sidebar/use-right-sidebar', () => ({
  useRightSidebar: () => rightSidebarState,
}))

vi.mock('../right-sidebar/runtime-source', () => ({
  createRuntimeRightSidebarSource: () => rightSidebarSource.current,
}))

vi.mock('../dnd-provider', () => ({
  WorkspaceRuntimeDndProvider: ({
    children,
    externalFiles,
    runtime,
    workspaceName,
  }: {
    children: ReactNode
    externalFiles: { status: string }
    runtime: WorkspaceRuntime
    workspaceName: string | null
  }) => {
    dndSpy({ externalFiles, runtime, workspaceName })
    return <div data-testid="workspace-runtime-dnd-provider">{children}</div>
  },
}))

vi.mock('../item-surface-hotkeys', () => ({
  WorkspaceRuntimeItemSurfaceHotkeys: ({ runtime }: { runtime: WorkspaceRuntime }) => (
    <div data-hotkeys-runtime={runtime.workspace.id} />
  ),
}))

vi.mock('../runtime-shell', () => ({
  WorkspaceRuntimeShell: (props: {
    ariaLabel: string
    rightSidebar: unknown
    sidebar: ReactNode
    viewStateStores: unknown
  }) => {
    shellSpy({ ...props, runtime: useWorkspaceRuntime() })
    return (
      <section aria-label={props.ariaLabel}>
        {props.sidebar}
        <div data-testid="workspace-runtime-shell" />
      </section>
    )
  },
}))

vi.mock('../search-dialog', () => ({
  WorkspaceRuntimeSearchDialog: (props: { runtime: WorkspaceRuntime }) => {
    searchDialogSpy(props)
    return <div data-testid="workspace-runtime-search-dialog" />
  },
}))

vi.mock('../../notes/scroll-request-provider', () => ({
  NoteScrollRequestProvider: ({
    children,
    value,
  }: {
    children: ReactNode
    value: { status: string }
  }) => <section data-scroll-request-status={value.status}>{children}</section>,
}))

vi.mock('../../notes/headings/scroll-request', () => ({
  useNoteHeadingScrollRequest: useNoteHeadingScrollRequestSpy,
}))

vi.mock('../sidebar/workspace-runtime-sidebar-content', () => ({
  WorkspaceRuntimeSidebarContent: (props: {
    bottomPanel?: ReactNode
    layout: string
    railEndControls?: ReactNode
    railStartControls?: ReactNode
    runtime: WorkspaceRuntime
    showPanelDivider: boolean
    topStartControls?: ReactNode
  }) => {
    sidebarContentSpy(props)
    return (
      <div data-testid={`${props.layout}-workspace-sidebar`}>
        <span>{props.runtime.workspace.id}</span>
        {props.topStartControls}
        {props.railStartControls}
        {props.railEndControls}
        {props.bottomPanel}
      </div>
    )
  },
}))

describe('WorkspaceRuntimeHost', () => {
  beforeEach(() => {
    shellSpy.mockReset()
    searchDialogSpy.mockReset()
    dndSpy.mockReset()
    sidebarContentSpy.mockReset()
    leftSidebarState.setSize.mockReset()
    leftSidebarState.setVisible.mockReset()
    rightSidebarState.close.mockReset()
    rightSidebarState.open.mockReset()
    rightSidebarState.setActiveContent.mockReset()
    rightSidebarState.setSize.mockReset()
    rightSidebarState.setVisible.mockReset()
    rightSidebarState.toggle.mockReset()
    rightSidebarSource.current.navigation.openItem.mockReset()
    rightSidebarSource.current.outline.getOutlineState.mockReset()
    rightSidebarSource.current.outline.navigateToHeading.mockReset()
    rightSidebarSource.current.resolveItem.mockReset()
    useNoteHeadingScrollRequestSpy.mockReset()
    useNoteHeadingScrollRequestSpy.mockImplementation((args) =>
      args.heading ? { status: 'requested' } : { status: 'none' },
    )
  })

  it('mounts the editor runtime graph with fixed sidebar and search from one runtime', () => {
    const runtime = createRuntime()

    render(
      <RuntimeHostHarness
        ariaLabel="Editor workspace"
        runtime={runtime}
        workspaceName="Test workspace"
      />,
    )

    expect(screen.getByLabelText('Editor workspace')).toBeInTheDocument()
    expect(screen.getByTestId('fixed-workspace-sidebar')).toHaveTextContent('workspace-a')
    expect(screen.getByTestId('workspace-runtime-shell')).toBeInTheDocument()
    expect(screen.getByTestId('workspace-runtime-search-dialog')).toBeInTheDocument()
    expect(dndSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        externalFiles: { status: 'enabled' },
        runtime: expect.objectContaining({
          workspace: expect.objectContaining({ id: 'workspace-a' }),
        }),
        workspaceName: 'Test workspace',
      }),
    )
    expect(shellSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        rightSidebar: { source: rightSidebarSource.current, state: rightSidebarState },
        runtime: expect.objectContaining({
          workspace: expect.objectContaining({ id: 'workspace-a' }),
        }),
        viewStateStores: expect.objectContaining({
          canvasViewport: expect.any(Object),
          mapTransform: expect.any(Object),
          noteScroll: expect.any(Object),
        }),
      }),
    )
    expect(searchDialogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        runtime: expect.objectContaining({
          workspace: expect.objectContaining({ id: 'workspace-a' }),
        }),
      }),
    )
  })

  it('renders view-as state from the workspace runtime capability', () => {
    const setSelectedParticipantId = vi.fn()
    const runtime = createRuntime({
      viewAsParticipant: {
        status: 'available',
        isPending: false,
        selectedParticipantId: 'member-a' as CampaignMemberId,
        setSelectedParticipantId,
        participants: [
          {
            id: 'member-a' as CampaignMemberId,
            displayName: 'Mina',
            username: 'mina',
            imageUrl: null,
          },
        ],
      },
    })

    render(
      <RuntimeHostHarness
        ariaLabel="Editor workspace"
        runtime={runtime}
        workspaceName="Test workspace"
      />,
    )

    expect(screen.getByText('Viewing as')).toBeInTheDocument()
    expect(screen.getByText('Mina')).toBeInTheDocument()
  })

  it('renders workspace-specific sidebar chrome through the shared resizable sidebar', () => {
    const runtime = createRuntime()

    render(
      <RuntimeHostHarness
        ariaLabel="Editor workspace"
        runtime={runtime}
        sidebar="resizable"
        sidebarSlots={{
          bottomPanel: <div data-testid="workspace-bottom-panel">Campaign</div>,
          railEndControls: <div data-testid="workspace-rail-end">User</div>,
          railStartControls: <div data-testid="workspace-rail-start">Players</div>,
        }}
        workspaceName={null}
      />,
    )

    expect(screen.getByTestId('left-resizable-sidebar')).toHaveAttribute('data-size', '280')
    expect(screen.getByTestId('fill-workspace-sidebar')).toHaveTextContent('workspace-a')
    expect(screen.getByTestId('workspace-bottom-panel')).toHaveTextContent('Campaign')
    expect(screen.getByTestId('workspace-rail-start')).toHaveTextContent('Players')
    expect(screen.getByTestId('workspace-rail-end')).toHaveTextContent('User')
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(leftSidebarState.setVisible).toHaveBeenCalledWith(false)
    expect(sidebarContentSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: 'fill',
        runtime: expect.objectContaining({
          workspace: expect.objectContaining({ id: 'workspace-a' }),
        }),
        showPanelDivider: true,
      }),
    )
  })

  it('routes heading requests through the current note content', () => {
    const runtime = createRuntime()
    const onConsumed = vi.fn()
    const contentItem = runtime.filesystem.current.contentItem
    if (contentItem?.type !== RESOURCE_TYPES.notes) {
      throw new Error('Expected note content item')
    }

    render(
      <RuntimeHostHarness
        ariaLabel="Editor workspace"
        noteHeadingRequest={{ heading: 'Intro', onConsumed }}
        runtime={runtime}
        workspaceName="Test workspace"
      />,
    )

    expect(
      screen.getByLabelText('Editor workspace').closest('[data-scroll-request-status]'),
    ).toHaveAttribute('data-scroll-request-status', 'requested')
    expect(useNoteHeadingScrollRequestSpy).toHaveBeenCalledWith({
      content: contentItem.content,
      heading: 'Intro',
      onConsumed,
    })
  })
})

function RuntimeHostHarness({
  panelPreferences = {
    appliedPanelPreferences: null,
    initialPanelPreferences: null,
    isLoaded: true,
  },
  runtime,
  ...props
}: Omit<ComponentProps<typeof WorkspaceRuntimeHost>, 'panelPreferences' | 'viewStateStores'> &
  Pick<Partial<ComponentProps<typeof WorkspaceRuntimeHost>>, 'panelPreferences'>) {
  return (
    <WorkspaceRuntimeHost
      {...props}
      panelPreferences={panelPreferences}
      runtime={runtime}
      viewStateStores={createMemoryWorkspaceViewStateStores()}
    />
  )
}

function createRuntime(options: Parameters<typeof createTestWorkspaceRuntime>[0] = {}) {
  const note = createNote({ name: 'Session notes' })
  const contentItem = {
    ...note,
    ancestors: [],
    blockMeta: {},
    blockShareAccessWarnings: [],
    content: [],
  } satisfies NoteItemWithContent

  return createTestWorkspaceRuntime({
    activeItems: [note],
    canCreateItems: true,
    contentItem,
    item: note,
    workspaceId: 'workspace-a',
    ...options,
  })
}
