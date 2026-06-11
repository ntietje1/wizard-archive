import { FileText, Image, Map, Network } from 'lucide-react'
import { useEffect, useState } from 'react'
import { assertSidebarItemName } from 'shared/sidebar-items/name'
import type { Id } from 'convex/_generated/dataModel'
import { CanvasReadOnlyPreview } from '~/features/canvas/components/canvas-read-only-preview'
import { EditorWorkspaceSurface } from '~/features/editor/components/editor-workspace-surface'
import { RawNoteContent } from '~/features/editor/components/raw-note-content'
import { FileContentViewer } from '~/features/editor/components/viewer/file/file-content-viewer'
import {
  DemoEditorTopbar,
  DemoSidebarFooter,
} from '~/features/landing/components/demo-editor-chrome'
import {
  INITIAL_DEMO_WORKSPACE,
  noteBodyToBlocks,
} from '~/features/landing/demo-workspace/demo-workspace-model'
import { SidebarTreeSurface } from '~/features/sidebar/components/sidebar-tree-surface'
import { SidebarWorkspaceShell } from '~/features/sidebar/components/sidebar-workspace-shell'
import type { DemoWorkspaceItemType } from '~/features/landing/demo-workspace/demo-workspace-model'

const itemIcons = {
  note: FileText,
  folder: FileText,
  canvas: Network,
  map: Map,
  file: Image,
} satisfies Record<DemoWorkspaceItemType, typeof FileText>

const previewOrder = ['note-market', 'canvas-heist', 'file-handout', 'map-docks'] as const

export function LandingWorkspacePreview() {
  const [selectedItemId, setSelectedItemId] = useState<(typeof previewOrder)[number]>('note-market')

  return <LandingWorkspaceFrame selectedItemId={selectedItemId} onSelectItem={setSelectedItemId} />
}

export function LandingCanvasPreview({ interactive = false }: { interactive?: boolean }) {
  return (
    <CanvasReadOnlyPreview
      nodes={INITIAL_DEMO_WORKSPACE.canvas.nodes}
      edges={INITIAL_DEMO_WORKSPACE.canvas.edges}
      interactive={interactive}
    />
  )
}

function LandingWorkspaceFrame({
  onSelectItem,
  selectedItemId,
}: {
  onSelectItem?: (itemId: (typeof previewOrder)[number]) => void
  selectedItemId: (typeof previewOrder)[number]
}) {
  const selectedItem =
    INITIAL_DEMO_WORKSPACE.items.find((item) => item.id === selectedItemId) ??
    INITIAL_DEMO_WORKSPACE.items[0]

  return (
    <SidebarWorkspaceShell
      sidebar={
        <LandingWorkspaceSidebar onSelectItem={onSelectItem} selectedItemId={selectedItemId} />
      }
    >
      <EditorWorkspaceSurface
        topbar={
          <DemoEditorTopbar
            title={<p className="truncate text-sm font-semibold">{selectedItem.title}</p>}
          />
        }
      >
        <LandingWorkspaceSurface itemId={selectedItemId} />
      </EditorWorkspaceSurface>
    </SidebarWorkspaceShell>
  )
}

function LandingWorkspaceSidebar({
  onSelectItem,
  selectedItemId,
}: {
  onSelectItem?: (itemId: (typeof previewOrder)[number]) => void
  selectedItemId: (typeof previewOrder)[number]
}) {
  const items = INITIAL_DEMO_WORKSPACE.items.map((item) => {
    const selected = item.id === selectedItemId

    return {
      id: item.id,
      icon: itemIcons[item.type],
      name: assertSidebarItemName(item.title),
      visualState: {
        isSelected: selected,
        isViewing: selected,
        isMultiSelected: false,
      },
      onClick: onSelectItem
        ? () => onSelectItem(item.id as (typeof previewOrder)[number])
        : undefined,
      pending: false,
    }
  })

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-background">
      <nav className="flex-1 overflow-auto p-1" aria-label="Landing preview items">
        <SidebarTreeSurface items={items} />
      </nav>
      <DemoSidebarFooter campaignName="Lanterns of Brindlehook" />
    </aside>
  )
}

function LandingWorkspaceSurface({ itemId }: { itemId: (typeof previewOrder)[number] }) {
  if (itemId === 'canvas-heist') {
    return <LandingCanvasPreview />
  }

  if (itemId === 'file-handout') {
    return <LandingFilePreview />
  }

  if (itemId === 'map-docks') {
    return <LandingMapTodo />
  }

  return (
    <RawNoteContent
      noteId={INITIAL_DEMO_WORKSPACE.note.id as Id<'sidebarItems'>}
      content={noteBodyToBlocks(INITIAL_DEMO_WORKSPACE.note.body)}
      editable={false}
      fillHeight
      className="note-editor-surface"
    />
  )
}

function LandingFilePreview() {
  const downloadUrl = useLandingPreviewFileUrl()

  return (
    <FileContentViewer
      allowObjectUrl
      contentType={INITIAL_DEMO_WORKSPACE.file.contentType}
      downloadUrl={downloadUrl}
      name={INITIAL_DEMO_WORKSPACE.file.name}
    />
  )
}

function useLandingPreviewFileUrl() {
  const [downloadUrl] = useState(() => {
    const blob = new Blob([INITIAL_DEMO_WORKSPACE.file.body], {
      type: INITIAL_DEMO_WORKSPACE.file.contentType,
    })

    return URL.createObjectURL(blob)
  })

  useEffect(() => {
    return () => URL.revokeObjectURL(downloadUrl)
  }, [downloadUrl])

  return downloadUrl
}

function LandingMapTodo() {
  return (
    <div className="flex h-full items-center justify-center bg-muted/20 p-6">
      <div className="max-w-md rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Maps are a demo TODO</p>
        <p className="mt-2">
          Map editing will move to the canvas model, so this public preview intentionally avoids a
          separate parallel map surface.
        </p>
      </div>
    </div>
  )
}
