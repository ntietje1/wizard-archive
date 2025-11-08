import {
  createFileRoute,
  useParams,
  useNavigate,
  useSearch,
} from '@tanstack/react-router'
import { CategoryPageContent } from './-components/category-page-content'
import { useCampaign } from '~/contexts/CampaignContext'
import type { Id } from 'convex/_generated/dataModel'
import {
  validateSearch,
  type CategorySearch,
} from './-components/validateFolderId'
import { CategoryFolderContextMenu } from './-components/folder/category-folder-context-menu'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/categories/$categorySlug/',
)({
  component: GenericCategoryPage,
  validateSearch: (search: Record<string, unknown>) => validateSearch(search),
})

function GenericCategoryPage() {
  const { dmUsername, campaignSlug } = useCampaign()
  const params = useParams({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/categories/$categorySlug/',
  })
  const categorySlug = params?.categorySlug ?? ''
  const navigate = useNavigate()
  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/categories/$categorySlug/',
  }) as CategorySearch

  const handleFolderNavigation = (folderId?: Id<'folders'>) => {
    navigate({
      to: '.',
      search: {
        folderId,
      },
    })
  }

  const handleCategoryUpdated = (newSlug: string) => {
    if (newSlug !== categorySlug) {
      navigate({
        to: '/campaigns/$dmUsername/$campaignSlug/categories/$categorySlug',
        params: {
          dmUsername,
          campaignSlug,
          categorySlug: newSlug,
        },
        search: {
          folderId: search.folderId,
        },
      })
    }
  }

  return (
    <CategoryPageContent
      categorySlug={categorySlug}
      currentFolderId={search.folderId}
      onNavigate={handleFolderNavigation}
      onCategoryUpdated={handleCategoryUpdated}
      FolderContextMenuComponent={CategoryFolderContextMenu}
    />
  )
}
