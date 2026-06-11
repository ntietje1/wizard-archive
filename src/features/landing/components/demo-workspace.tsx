import { FileText, FolderOpen, MapIcon, Network } from 'lucide-react'
import { Fragment, useReducer } from 'react'
import { CreateNewDashboardSurface } from '~/features/editor/components/create-new-dashboard-surface'
import { EditorContent } from '~/features/editor/components/editor-content'
import { EditorWorkspaceSurface } from '~/features/editor/components/editor-workspace-surface'
import { FileTopbar } from '~/features/editor/components/topbar/file-topbar'
import { useLocalDemoFileViewerSource } from '~/features/landing/demo-workspace/local-demo-file-viewer-source'
import { SidebarTreeSurface } from '~/features/sidebar/components/sidebar-tree-surface'
import { SidebarWorkspaceShell } from '~/features/sidebar/components/sidebar-workspace-shell'
import { buildSidebarTreeSurfaceItems } from '~/features/sidebar/workspace/sidebar-tree-projection'
import {
  createLocalDemoEditorWorkspaceSource,
  useLocalDemoCanvasViewerSource,
  useLocalDemoNoteDocuments,
} from '../demo-workspace/local-demo-editor-workspace-source'
import {
  INITIAL_DEMO_WORKSPACE,
  demoSidebarItemsWithContent,
  demoWorkspaceReducer,
  selectedDemoItem,
} from '../demo-workspace/demo-workspace-model'
import { DemoSidebarFooter } from './demo-editor-chrome'
import type {
  DemoWorkspaceItem,
  DemoWorkspaceItemType,
} from '../demo-workspace/demo-workspace-model'
import { assertSidebarItemName } from 'shared/sidebar-items/name'
import type { Dispatch, MouseEvent } from 'react'

const itemIcons = {
  note: FileText,
  folder: FolderOpen,
  canvas: Network,
  map: MapIcon,
  file: FolderOpen,
} satisfies Record<DemoWorkspaceItemType, typeof FileText>

const noop = () => {}

export function DemoWorkspace() {
  const [workspace, dispatch] = useReducer(demoWorkspaceReducer, INITIAL_DEMO_WORKSPACE)
  const canvasViewerSource = useLocalDemoCanvasViewerSource(workspace)
  const fileViewerSource = useLocalDemoFileViewerSource(workspace)
  const noteDocuments = useLocalDemoNoteDocuments(workspace)
  const workspaceSource = createLocalDemoEditorWorkspaceSource({
    canvasViewerSource,
    dispatch,
    fileViewerSource,
    noteDocuments,
    workspace,
  })
  const selectedItem = selectedDemoItem(workspace)

  return (
    <section
      className="flex h-full min-h-0 bg-background text-foreground"
      aria-label="Demo workspace"
    >
      <SidebarWorkspaceShell
        sidebar={
          <DemoWorkspaceSidebar
            workspace={workspace}
            selectedItem={selectedItem}
            dispatch={dispatch}
          />
        }
      >
        <EditorWorkspaceSurface
          topbar={<FileTopbar onToggleHistory={noop} source={workspaceSource} />}
        >
          <DemoWorkspaceSurfaces
            workspace={workspace}
            selectedItem={selectedItem}
            dispatch={dispatch}
            fileViewerSource={fileViewerSource}
            noteDocuments={noteDocuments}
            canvasViewerSource={canvasViewerSource}
            workspaceSource={workspaceSource}
          />
        </EditorWorkspaceSurface>
      </SidebarWorkspaceShell>
    </section>
  )
}

function DemoWorkspaceSidebar({
  dispatch,
  selectedItem,
  workspace,
}: {
  dispatch: Dispatch<Parameters<typeof demoWorkspaceReducer>[1]>
  selectedItem: DemoWorkspaceItem | null
  workspace: typeof INITIAL_DEMO_WORKSPACE
}) {
  const projectedItemsById = new Map(
    demoSidebarItemsWithContent(workspace).map((item) => [String(item._id), item]),
  )
  const sidebarItems = buildSidebarTreeSurfaceItems(
    workspace.items.map((item) => {
      const selected = item.id === selectedItem?.id
      const projectedItem = projectedItemsById.get(item.id)

      return {
        id: item.id,
        parentId: null,
        icon: itemIcons[item.type],
        name: projectedItem?.name ?? assertSidebarItemName(item.title || 'Untitled'),
        visualState: {
          isSelected: selected,
          isViewing: selected,
          isMultiSelected: false,
        },
        onClick: (event: MouseEvent) => {
          event.preventDefault()
          dispatch({ type: 'selectItem', itemId: item.id })
        },
        onContextMenu: (event: MouseEvent) => event.preventDefault(),
      }
    }),
  )

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r bg-background">
      <nav className="flex-1 overflow-auto p-1" aria-label="Demo items">
        <SidebarTreeSurface items={sidebarItems} />
      </nav>
      <DemoSidebarFooter
        campaignName="Lanterns of Brindlehook"
        onOpenCreateDashboard={() => dispatch({ type: 'openCreateDashboard' })}
      />
    </aside>
  )
}

function DemoWorkspaceSurfaces({
  dispatch,
  canvasViewerSource,
  fileViewerSource,
  noteDocuments,
  selectedItem,
  workspace,
  workspaceSource,
}: {
  dispatch: Dispatch<Parameters<typeof demoWorkspaceReducer>[1]>
  canvasViewerSource: ReturnType<typeof useLocalDemoCanvasViewerSource>
  fileViewerSource: ReturnType<typeof useLocalDemoFileViewerSource>
  noteDocuments: ReturnType<typeof useLocalDemoNoteDocuments>
  selectedItem: DemoWorkspaceItem | null
  workspace: typeof INITIAL_DEMO_WORKSPACE
  workspaceSource: ReturnType<typeof createLocalDemoEditorWorkspaceSource>
}) {
  if (workspace.activeView === 'create') {
    return <EditorContent source={workspaceSource} />
  }

  if (!selectedItem) {
    return null
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      {workspace.items.map((item) => (
        <Fragment key={item.id}>
          {workspace.mountedItemIds.includes(item.id) && !isEditorContentDemoItem(item) && (
            <DemoWorkspaceSurface
              item={item}
              active={item.id === selectedItem.id}
              dispatch={dispatch}
            />
          )}
          {item.id === selectedItem.id && isEditorContentDemoItem(item) && (
            <DemoEditorContentSurface
              item={item}
              workspace={workspace}
              dispatch={dispatch}
              fileViewerSource={fileViewerSource}
              noteDocuments={noteDocuments}
              canvasViewerSource={canvasViewerSource}
            />
          )}
        </Fragment>
      ))}
    </main>
  )
}

function isEditorContentDemoItem(item: DemoWorkspaceItem) {
  return (
    item.type === 'note' || item.type === 'canvas' || item.type === 'file' || item.type === 'map'
  )
}

function DemoEditorContentSurface({
  canvasViewerSource,
  dispatch,
  fileViewerSource,
  item,
  noteDocuments,
  workspace,
}: {
  canvasViewerSource: ReturnType<typeof useLocalDemoCanvasViewerSource>
  dispatch: Dispatch<Parameters<typeof demoWorkspaceReducer>[1]>
  fileViewerSource: ReturnType<typeof useLocalDemoFileViewerSource>
  item: DemoWorkspaceItem
  noteDocuments: ReturnType<typeof useLocalDemoNoteDocuments>
  workspace: typeof INITIAL_DEMO_WORKSPACE
}) {
  const source = createLocalDemoEditorWorkspaceSource({
    activeView: 'item',
    canvasViewerSource,
    dispatch,
    fileViewerSource,
    noteDocuments,
    selectedItemId: item.id,
    workspace,
  })

  return (
    <section className="contents" aria-label={item.title} data-demo-surface={item.type}>
      <EditorContent source={source} />
    </section>
  )
}

function DemoWorkspaceSurface({
  active,
  dispatch,
  item,
}: {
  active: boolean
  dispatch: Dispatch<Parameters<typeof demoWorkspaceReducer>[1]>
  item: DemoWorkspaceItem
}) {
  return (
    <section
      className="contents"
      hidden={!active}
      aria-label={item.title}
      data-demo-surface={item.type}
    >
      {item.type === 'folder' && (
        <CreateNewDashboardSurface
          folderPath={item.title}
          onCreate={(command) => dispatch({ type: 'createItem', commandKey: command.key })}
        />
      )}
    </section>
  )
}
