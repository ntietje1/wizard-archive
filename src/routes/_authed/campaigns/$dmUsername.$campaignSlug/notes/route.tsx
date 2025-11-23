import { ClientOnly, createFileRoute, useSearch } from '@tanstack/react-router'
import { SidebarLayout } from './-components/layout/sidebar-layout'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/shadcn/style.css'
import { NotesPageLayout } from './-components/page/index'
import { NotesEditor } from './-components/editor/notes-editor'
import {
  validateSearch,
  type NotesSearch,
} from './-components/validateSearch'
import { MapViewer } from '~/components/notes-page/map/map-viewer'
import { CategoryPageContent } from '~/components/notes-page/category/category-page-content'
import { CategoryFolderContextMenu } from '~/components/context-menu/category/category-folder-context-menu'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import type { Id } from 'convex/_generated/dataModel'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/notes',
)({
  component: NotesLayout,
  validateSearch: (search: Record<string, unknown>) => validateSearch(search),
})

function NotesLayout() {
  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/notes',
  }) as NotesSearch
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

  // Priority: note > map > category > default (empty editor)
  if (search.note) {
    content = <NotesEditor />
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

  return (
    <ClientOnly>
      <SidebarLayout>
        <NotesPageLayout>{content}</NotesPageLayout>
      </SidebarLayout>
    </ClientOnly>
  )
}
