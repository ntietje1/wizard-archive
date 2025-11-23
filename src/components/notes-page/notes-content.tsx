import { useSearch } from '@tanstack/react-router'
import { NotesEditor } from './editor/notes-editor'
import { MapViewer } from './viewer/map-viewer'
import { CategoryPageContent } from './category/category-page-content'
import { CategoryFolderContextMenu } from '~/components/context-menu/category/category-folder-context-menu'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import type { Id } from 'convex/_generated/dataModel'
import type { EditorSearch } from './validate-search'
import { NotesViewer } from './viewer/notes-viewer'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../shadcn/ui/resizable'

export function EditorContent() {
  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/editor',
  }) as EditorSearch
  const { navigateToCategory } = useEditorNavigation()

  const handleCategoryNavigate = (folderId?: Id<'folders'>) => {
    if (search.category) {
      navigateToCategory(search.category, folderId)
    }
  }

  const handleCategoryUpdated = (newSlug: string) => {
    if (newSlug !== search.category) {
      navigateToCategory(newSlug)
    }
  }

  let content: React.ReactNode = null

  if (search.note) {
    content = 
    <ResizablePanelGroup direction="horizontal" autoSaveId="notes-content" className="flex-1 min-h-0">
      <ResizablePanel defaultSize={50} minSize={25} className="flex min-h-0 flex-col">
        <NotesEditor />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel defaultSize={50} minSize={25} className="flex min-h-0 flex-col">
        <NotesViewer />
      </ResizablePanel>
    </ResizablePanelGroup>
  } else if (search.map) {
    content = <MapViewer map={search.map} />
  } else if (search.category) {
    content = (
      <CategoryPageContent
        categorySlug={search.category}
        currentFolderId={search.folderId}
        onNavigate={handleCategoryNavigate}
        onCategoryUpdated={handleCategoryUpdated}
        FolderContextMenuComponent={CategoryFolderContextMenu}
      />
    )
  } else {
    content = <NotesEditor />
  }

  return content
}

