import { Download, FileText, FolderOpen, Map, Network, RotateCcw, Upload } from 'lucide-react'
import { Fragment, useEffect, useReducer, useRef, useState } from 'react'
import { EditorWorkspaceSurface } from '~/features/editor/components/editor-workspace-surface'
import { FileContentViewer } from '~/features/editor/components/viewer/file/file-content-viewer'
import { RawNoteContent } from '~/features/editor/components/raw-note-content'
import { EditorTopbarSurface } from '~/features/editor/components/topbar/editor-topbar-surface'
import { LocalCanvasEditor } from '~/features/landing/demo-workspace/local-canvas-editor'
import { Button, buttonVariants } from '~/features/shadcn/components/button'
import { Input } from '~/features/shadcn/components/input'
import { cn } from '~/features/shadcn/lib/utils'
import { SidebarRow } from '~/features/sidebar/components/sidebar-row'
import { SidebarTreeSurface } from '~/features/sidebar/components/sidebar-tree-surface'
import { SidebarWorkspaceShell } from '~/features/sidebar/components/sidebar-workspace-shell'
import {
  INITIAL_DEMO_WORKSPACE,
  demoWorkspaceReducer,
  noteBodyToBlocks,
  selectedDemoItem,
} from '../demo-workspace/demo-workspace-model'
import type {
  DemoMapPin,
  DemoWorkspaceItem,
  DemoWorkspaceItemType,
} from '../demo-workspace/demo-workspace-model'
import type { Id } from 'convex/_generated/dataModel'
import { assertSidebarItemName } from 'shared/sidebar-items/name'
import type { ChangeEvent, Dispatch, MouseEvent, RefObject } from 'react'

const itemIcons = {
  note: FileText,
  canvas: Network,
  map: Map,
  file: FolderOpen,
} satisfies Record<DemoWorkspaceItemType, typeof FileText>

export function DemoWorkspace() {
  const [workspace, dispatch] = useReducer(demoWorkspaceReducer, INITIAL_DEMO_WORKSPACE)
  const selectedItem = selectedDemoItem(workspace)

  return (
    <section
      className="flex min-h-[calc(100svh-4rem)] bg-background text-foreground"
      aria-label="Ephemeral demo workspace"
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
          <DemoWorkspaceSurfaces workspace={workspace} selectedItem={selectedItem} />
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
  selectedItem: DemoWorkspaceItem
  workspace: typeof INITIAL_DEMO_WORKSPACE
}) {
  const sidebarItems = workspace.items.map((item) => {
    const selected = item.id === selectedItem.id

    return {
      id: item.id,
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
  })

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r bg-background">
      <div className="border-b px-3 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Demo campaign
        </p>
        <h1 className="mt-1 truncate text-sm font-semibold">{workspace.campaignName}</h1>
      </div>
      <nav className="flex-1 overflow-auto p-1" aria-label="Demo campaign items">
        <SidebarTreeSurface items={sidebarItems} />
      </nav>
      <div className="border-t p-1">
        <SidebarRow icon={FolderOpen} label="Trash" />
      </div>
    </aside>
  )
}

function DemoWorkspaceTopbar({
  dispatch,
  selectedItem,
}: {
  dispatch: Dispatch<Parameters<typeof demoWorkspaceReducer>[1]>
  selectedItem: DemoWorkspaceItem
}) {
  return (
    <EditorTopbarSurface
      title={
        <Input
          aria-label="Selected item name"
          value={selectedItem.title}
          onChange={(event) =>
            dispatch({ type: 'renameSelectedItem', title: event.currentTarget.value })
          }
          className="h-8 max-w-lg border-transparent bg-transparent px-1 text-base font-medium shadow-none focus-visible:bg-control-surface focus-visible:px-2"
        />
      }
      middleContent={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => dispatch({ type: 'reset' })}
        >
          <RotateCcw aria-hidden="true" />
          Reset demo
        </Button>
      }
    />
  )
}

function DemoWorkspaceSurfaces({
  selectedItem,
  workspace,
}: {
  selectedItem: DemoWorkspaceItem
  workspace: typeof INITIAL_DEMO_WORKSPACE
}) {
  return (
    <main className="flex min-h-0 flex-1 flex-col">
      {workspace.items.map((item) => (
        <Fragment key={`${workspace.resetToken}:${item.id}`}>
          {workspace.mountedItemIds.includes(item.id) && (
            <DemoWorkspaceSurface
              item={item}
              active={item.id === selectedItem.id}
              workspace={workspace}
            />
          )}
        </Fragment>
      ))}
    </main>
  )
}

function DemoWorkspaceSurface({
  active,
  item,
  workspace,
}: {
  active: boolean
  item: DemoWorkspaceItem
  workspace: typeof INITIAL_DEMO_WORKSPACE
}) {
  return (
    <section
      className="contents"
      hidden={!active}
      aria-label={item.title}
      data-demo-surface={item.type}
    >
      {item.type === 'note' && (
        <DemoNoteEditor
          noteId={workspace.note.id as Id<'sidebarItems'>}
          body={workspace.note.body}
        />
      )}
      {item.type === 'canvas' && (
        <LocalCanvasEditor
          canvasId={workspace.canvas.id as Id<'sidebarItems'>}
          nodes={workspace.canvas.nodes}
          edges={workspace.canvas.edges}
        />
      )}
      {item.type === 'map' && <DemoMapSurface pins={workspace.map.pins} />}
      {item.type === 'file' && (
        <DemoFileSurface
          initialBody={workspace.file.body}
          initialContentType={workspace.file.contentType}
          initialName={workspace.file.name}
        />
      )}
    </section>
  )
}

function DemoNoteEditor({ body, noteId }: { body: string; noteId: Id<'sidebarItems'> }) {
  return (
    <div className="note-editor-fill-height flex min-h-0 flex-1 flex-col">
      <RawNoteContent
        noteId={noteId}
        content={noteBodyToBlocks(body)}
        editable
        className="note-editor-surface"
      />
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
