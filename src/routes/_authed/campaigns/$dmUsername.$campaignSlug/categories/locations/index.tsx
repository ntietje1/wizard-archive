import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { CategoryPageContent } from '../$categorySlug/-components/category-page-content'
import LocationTagDialog from '~/components/forms/category-tag-form/location-tag-form/location-tag-dialog'
import {
  validateSearch,
  type CategorySearch,
} from '../$categorySlug/-components/validateFolderId'
import type { Id } from 'convex/_generated/dataModel'
import { LocationTagCardWithContextMenu } from './-components/location-card'
import { LocationFolderCardWithContextMenu } from './-components/location-folder-card'
import { LocationFolderContextMenu } from './-components/location-folder-context-menu'
import { MapCardWithContextMenu } from './-components/map-card'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/categories/locations/',
)({
  component: LocationsPage,
  validateSearch: (search: Record<string, unknown>) => validateSearch(search),
})

function LocationsPage() {
  const navigate = useNavigate()
  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/categories/locations/',
  }) as CategorySearch

  const handleFolderNavigation = (folderId?: Id<'folders'>) => {
    navigate({
      to: '.',
      search: {
        folderId,
      },
    })
  }

  return (
    <CategoryPageContent
      categorySlug="locations"
      currentFolderId={search.folderId}
      onNavigate={handleFolderNavigation}
      TagDialogComponent={LocationTagDialog}
      TagCardComponent={LocationTagCardWithContextMenu}
      FolderCardComponent={LocationFolderCardWithContextMenu}
      MapCardComponent={MapCardWithContextMenu}
      FolderContextMenuComponent={LocationFolderContextMenu}
    />
  )
}
