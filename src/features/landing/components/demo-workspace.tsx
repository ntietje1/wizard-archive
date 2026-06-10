import { Download, FileText, FolderOpen, MapIcon, Network, Upload } from 'lucide-react'
import { Fragment, useEffect, useReducer, useRef, useState } from 'react'
import { CreateNewDashboardSurface } from '~/features/editor/components/create-new-dashboard-surface'
import { EditorWorkspaceSurface } from '~/features/editor/components/editor-workspace-surface'
import { NoteFormattingToolbar } from '~/features/editor/components/formatting-toolbar/note-formatting-toolbar'
import { FileContentViewer } from '~/features/editor/components/viewer/file/file-content-viewer'
import { LocalCanvasEditor } from '~/features/landing/demo-workspace/local-canvas-editor'
import { LocalNoteEditor } from '~/features/landing/demo-workspace/local-note-editor'
import { Button, buttonVariants } from '~/features/shadcn/components/button'
import { Input } from '~/features/shadcn/components/input'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { cn } from '~/features/shadcn/lib/utils'
import { SidebarTreeSurface } from '~/features/sidebar/components/sidebar-tree-surface'
import { SidebarWorkspaceShell } from '~/features/sidebar/components/sidebar-workspace-shell'
import { buildSidebarTreeSurfaceItems } from '~/features/sidebar/workspace/sidebar-tree-projection'
import {
  INITIAL_DEMO_WORKSPACE,
  demoCanvasForItem,
  demoFileForItem,
  demoMapPinsForItem,
  demoNoteBodyForItem,
  demoWorkspaceReducer,
  selectedDemoItem,
} from '../demo-workspace/demo-workspace-model'
import { DemoEditorTopbar, DemoSidebarFooter } from './demo-editor-chrome'
import type {
  DemoMapPin,
  DemoWorkspaceItem,
  DemoWorkspaceItemType,
} from '../demo-workspace/demo-workspace-model'
import type { CustomBlockNoteEditor } from '~/features/editor/editor-specs'
import type { Id } from 'convex/_generated/dataModel'
import { assertSidebarItemName } from 'shared/sidebar-items/name'
import type { ChangeEvent, Dispatch, MouseEvent, RefObject } from 'react'

const itemIcons = {
  note: FileText,
  folder: FolderOpen,
  canvas: Network,
  map: MapIcon,
  file: FolderOpen,
} satisfies Record<DemoWorkspaceItemType, typeof FileText>

export function DemoWorkspace() {
  const [workspace, dispatch] = useReducer(demoWorkspaceReducer, INITIAL_DEMO_WORKSPACE)
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
          topbar={<DemoWorkspaceTopbar selectedItem={selectedItem} dispatch={dispatch} />}
        >
          <DemoWorkspaceSurfaces
            workspace={workspace}
            selectedItem={selectedItem}
            dispatch={dispatch}
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
  const sidebarItems = buildSidebarTreeSurfaceItems(
    workspace.items.map((item) => {
      const selected = item.id === selectedItem?.id

      return {
        id: item.id,
        parentId: null,
        icon: itemIcons[item.type],
        name: assertSidebarItemName(item.title || 'Untitled'),
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

function DemoWorkspaceTopbar({
  dispatch,
  selectedItem,
}: {
  dispatch: Dispatch<Parameters<typeof demoWorkspaceReducer>[1]>
  selectedItem: (typeof INITIAL_DEMO_WORKSPACE.items)[number] | null
}) {
  const title = (() => {
    if (selectedItem === null) {
      return <p className="truncate text-sm font-semibold">Untitled Item</p>
    }

    return (
      <Input
        aria-label="Selected item name"
        value={selectedItem.title}
        onChange={(event) =>
          dispatch({ type: 'renameSelectedItem', title: event.currentTarget.value })
        }
        className="h-8 max-w-lg border-transparent bg-transparent px-1 text-base font-medium shadow-none focus-visible:bg-control-surface focus-visible:px-2"
      />
    )
  })()

  return <DemoEditorTopbar title={title} />
}

function DemoWorkspaceSurfaces({
  dispatch,
  selectedItem,
  workspace,
}: {
  dispatch: Dispatch<Parameters<typeof demoWorkspaceReducer>[1]>
  selectedItem: DemoWorkspaceItem | null
  workspace: typeof INITIAL_DEMO_WORKSPACE
}) {
  if (workspace.activeView === 'create') {
    return (
      <main className="flex min-h-0 flex-1 flex-col">
        <CreateNewDashboardSurface
          onCreate={(command) => dispatch({ type: 'createItem', commandKey: command.key })}
        />
      </main>
    )
  }

  if (!selectedItem) {
    return null
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      {workspace.items.map((item) => (
        <Fragment key={item.id}>
          {workspace.mountedItemIds.includes(item.id) && (
            <DemoWorkspaceSurface
              item={item}
              active={item.id === selectedItem.id}
              workspace={workspace}
              dispatch={dispatch}
            />
          )}
        </Fragment>
      ))}
    </main>
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
  const file = item.type === 'file' ? demoFileForItem(workspace, item) : null

  return (
    <section
      className="contents"
      hidden={!active}
      aria-label={item.title}
      data-demo-surface={item.type}
    >
      {item.type === 'note' && (
        <DemoNoteEditor
          noteId={item.id as Id<'sidebarItems'>}
          body={demoNoteBodyForItem(workspace, item.id)}
        />
      )}
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
        />
      )}
      {item.type === 'map' && <DemoMapSurface pins={demoMapPinsForItem(workspace, item.id)} />}
      {item.type === 'file' && (
        <DemoFileSurface
          initialBody={file?.body ?? ''}
          initialContentType={file?.contentType ?? 'text/plain'}
          initialName={file?.name ?? 'Untitled File.txt'}
        />
      )}
    </section>
  )
}

function DemoNoteEditor({ body, noteId }: { body: string; noteId: Id<'sidebarItems'> }) {
  const [editor, setEditor] = useState<CustomBlockNoteEditor | null>(null)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <NoteFormattingToolbar editor={editor} visible />
      <ScrollArea className="min-h-0 flex-1" contentClassName="note-editor-scroll-content">
        <LocalNoteEditor
          noteId={noteId}
          body={body}
          editable
          className="note-editor-surface"
          onEditorChange={setEditor}
        />
      </ScrollArea>
    </div>
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

type LocalDemoFile = {
  name: string
  contentType: string
  size: number
  url: string
}

function DemoFileSurface({
  initialBody,
  initialContentType,
  initialName,
}: {
  initialBody: string
  initialContentType: string
  initialName: string
}) {
  const { file, fileInputRef, handleFileChange } = useLocalDemoFile({
    initialBody,
    initialContentType,
    initialName,
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted/20">
      <DemoFileHeader file={file} fileInputRef={fileInputRef} onFileChange={handleFileChange} />
      <section className="min-h-0 flex-1" aria-label="Demo file preview">
        <FileContentViewer
          allowObjectUrl
          contentType={file.contentType}
          downloadUrl={file.url}
          name={file.name}
        />
      </section>
    </div>
  )
}

function useLocalDemoFile({
  initialBody,
  initialContentType,
  initialName,
}: {
  initialBody: string
  initialContentType: string
  initialName: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<LocalDemoFile>(() =>
    createTextDemoFile({
      body: initialBody,
      contentType: initialContentType,
      name: initialName,
    }),
  )

  useEffect(() => {
    return () => URL.revokeObjectURL(file.url)
  }, [file.url])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!selectedFile) return

    const url = URL.createObjectURL(selectedFile)
    const contentType = selectedFile.type || 'application/octet-stream'
    const nextFile: LocalDemoFile = {
      name: selectedFile.name,
      contentType,
      size: selectedFile.size,
      url,
    }
    setFile(nextFile)
  }

  return { file, fileInputRef, handleFileChange }
}

function DemoFileHeader({
  file,
  fileInputRef,
  onFileChange,
}: {
  file: LocalDemoFile
  fileInputRef: RefObject<HTMLInputElement | null>
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <header className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b bg-background px-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {`${file.contentType} · ${formatFileSize(file.size)}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a
          href={file.url}
          download={file.name}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          <Download aria-hidden="true" />
          Download
        </a>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload aria-hidden="true" />
          Replace
        </Button>
        <input
          ref={fileInputRef}
          aria-label="Choose demo file"
          className="sr-only"
          type="file"
          onChange={onFileChange}
        />
      </div>
    </header>
  )
}

function createTextDemoFile({
  body,
  contentType,
  name,
}: {
  body: string
  contentType: string
  name: string
}): LocalDemoFile {
  const blob = new Blob([body], { type: contentType })
  return {
    name,
    contentType,
    size: blob.size,
    url: URL.createObjectURL(blob),
  }
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
