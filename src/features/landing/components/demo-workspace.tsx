import { FileText, FolderOpen, MapIcon, Network } from 'lucide-react'
import { Fragment, useReducer } from 'react'
import { CreateNewDashboardSurface } from '~/features/editor/components/create-new-dashboard-surface'
import { EditorContent } from '~/features/editor/components/editor-content'
import { EditorWorkspaceSurface } from '~/features/editor/components/editor-workspace-surface'
import { FileTopbar } from '~/features/editor/components/topbar/file-topbar'
import { LocalCanvasEditor } from '~/features/landing/demo-workspace/local-canvas-editor'
import { useLocalDemoFileViewerSource } from '~/features/landing/demo-workspace/local-demo-file-viewer-source'
import { SidebarTreeSurface } from '~/features/sidebar/components/sidebar-tree-surface'
import { SidebarWorkspaceShell } from '~/features/sidebar/components/sidebar-workspace-shell'
import { buildSidebarTreeSurfaceItems } from '~/features/sidebar/workspace/sidebar-tree-projection'
import {
  createDemoEmbeddedCanvasStateResolver,
  createDemoSidebarItemEmbedResolver,
} from '../demo-workspace/local-demo-embed-resolvers'
import {
  createLocalDemoEditorWorkspaceSource,
  useLocalDemoNoteDocuments,
} from '../demo-workspace/local-demo-editor-workspace-source'
import {
  INITIAL_DEMO_WORKSPACE,
  demoCanvasForItem,
  demoMapPinsForItem,
  demoSidebarItemsWithContent,
  demoWorkspaceReducer,
  selectedDemoItem,
} from '../demo-workspace/demo-workspace-model'
import { DemoSidebarFooter } from './demo-editor-chrome'
import type {
  DemoMapPin,
  DemoWorkspaceItem,
  DemoWorkspaceItemType,
} from '../demo-workspace/demo-workspace-model'
import type { Id } from 'convex/_generated/dataModel'
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
  const fileViewerSource = useLocalDemoFileViewerSource(workspace)
  const noteDocuments = useLocalDemoNoteDocuments(workspace)
  const workspaceSource = createLocalDemoEditorWorkspaceSource({
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
  fileViewerSource,
  noteDocuments,
  selectedItem,
  workspace,
  workspaceSource,
}: {
  dispatch: Dispatch<Parameters<typeof demoWorkspaceReducer>[1]>
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
              workspace={workspace}
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
            />
          )}
        </Fragment>
      ))}
    </main>
  )
}

function isEditorContentDemoItem(item: DemoWorkspaceItem) {
  return item.type === 'note' || item.type === 'file'
}

function DemoEditorContentSurface({
  dispatch,
  fileViewerSource,
  item,
  noteDocuments,
  workspace,
}: {
  dispatch: Dispatch<Parameters<typeof demoWorkspaceReducer>[1]>
  fileViewerSource: ReturnType<typeof useLocalDemoFileViewerSource>
  item: DemoWorkspaceItem
  noteDocuments: ReturnType<typeof useLocalDemoNoteDocuments>
  workspace: typeof INITIAL_DEMO_WORKSPACE
}) {
  const source = createLocalDemoEditorWorkspaceSource({
    activeView: 'item',
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
  workspace,
}: {
  active: boolean
  dispatch: Dispatch<Parameters<typeof demoWorkspaceReducer>[1]>
  item: DemoWorkspaceItem
  workspace: typeof INITIAL_DEMO_WORKSPACE
}) {
  const canvas = item.type === 'canvas' ? demoCanvasForItem(workspace, item.id) : null
  const SidebarItemEmbedResolver = createDemoSidebarItemEmbedResolver(workspace)
  const EmbeddedCanvasStateResolver = createDemoEmbeddedCanvasStateResolver(workspace)

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
      {item.type === 'canvas' && (
        <LocalCanvasEditor
          canvasId={canvas?.id as Id<'sidebarItems'>}
          nodes={canvas?.nodes ?? []}
          edges={canvas?.edges ?? []}
          EmbeddedCanvasStateResolver={EmbeddedCanvasStateResolver}
          SidebarItemEmbedResolver={SidebarItemEmbedResolver}
        />
      )}
      {item.type === 'map' && <DemoMapSurface pins={demoMapPinsForItem(workspace, item.id)} />}
    </section>
  )
}

function DemoMapSurface({ pins }: { pins: Array<DemoMapPin> }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/20 p-6">
      <div className="relative h-full max-h-[42rem] w-full max-w-5xl overflow-hidden rounded-lg border bg-[linear-gradient(135deg,var(--muted),transparent_55%),radial-gradient(circle_at_35%_40%,var(--t-blue)_0,transparent_24%),radial-gradient(circle_at_70%_65%,var(--t-green)_0,transparent_22%)]">
        <ul className="sr-only">
          {pins.map((pin) => (
            <li key={pin.id}>{`${pin.label}: ${pin.detail}`}</li>
          ))}
        </ul>
        {pins.map((pin) => (
          <span
            key={pin.id}
            className="absolute size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary bg-background text-primary shadow-sm"
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            aria-hidden="true"
            title={pin.detail}
            data-visible-to-players={pin.visibleToPlayers}
          />
        ))}
      </div>
    </div>
  )
}
