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
import { MapViewer } from '../categories/locations/-components/map-viewer'
import { CategoryPageContent } from '../categories/$categorySlug/-components/category-page-content'
import { CategoryFolderContextMenu } from '~/components/context-menu/category/category-folder-context-menu'
import { useNavigate } from '@tanstack/react-router'
import { useCampaign } from '~/contexts/CampaignContext'
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
  const navigate = useNavigate()
  const { dmUsername, campaignSlug } = useCampaign()

  const handleCategoryNavigate = (folderId?: Id<'folders'>) => {
    navigate({
      to: '/campaigns/$dmUsername/$campaignSlug/notes',
      params: { dmUsername, campaignSlug },
      search: {
        categorySlug: search.categorySlug,
        folderId,
      },
    })
  }

  const handleCategoryUpdated = (newSlug: string) => {
    if (newSlug !== search.categorySlug) {
      navigate({
        to: '/campaigns/$dmUsername/$campaignSlug/notes',
        params: { dmUsername, campaignSlug },
        search: {
          categorySlug: newSlug,
          folderId: search.folderId,
        },
      })
    }
  }

  let content: React.ReactNode = null

  if (search.mapId) {
    content = <MapViewer mapId={search.mapId} />
  } else if (search.categorySlug) {
    content = (
      <CategoryPageContent
        categorySlug={search.categorySlug}
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
