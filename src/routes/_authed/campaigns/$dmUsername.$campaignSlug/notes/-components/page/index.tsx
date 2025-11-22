import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '~/components/shadcn/ui/resizable'
import { NotesViewer } from '../viewer/notes-viewer'
import { FileTopbar } from '../editor/file-topbar/topbar'
import { ClientOnly } from '@tanstack/react-router'
import { useSearch } from '@tanstack/react-router'
import type { NotesSearch } from '../validateSearch'

export function NotesPageLayout({ children }: { children: React.ReactNode }) {
  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/notes',
  }) as NotesSearch

  // Only show NotesViewer when viewing a note (not a map or category)
  const showNotesViewer = !search.mapId && !search.categorySlug

  if (showNotesViewer) {
    return (
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 min-h-0"
        autoSaveId="notes-page-layout"
      >
        <ResizablePanel
          defaultSize={50}
          minSize={25}
          className="flex min-h-0 flex-col"
        >
          <FileTopbar />
          {children}
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel
          defaultSize={50}
          minSize={25}
          className="flex min-h-0 flex-col"
        >
          <ClientOnly>
            <NotesViewer />
          </ClientOnly>
        </ResizablePanel>
      </ResizablePanelGroup>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <FileTopbar />
      {children}
    </div>
  )
}
