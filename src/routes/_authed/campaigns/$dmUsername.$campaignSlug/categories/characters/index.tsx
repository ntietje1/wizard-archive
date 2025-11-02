import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { CategoryPageContent } from '../$categorySlug/-components/category-page-content'
import CharacterTagDialog from '~/components/forms/category-tag-form/character-tag-form/character-tag-dialog'
import {
  validateSearch,
  type CategorySearch,
} from '../$categorySlug/-components/validateFolderId'
import type { Id } from 'convex/_generated/dataModel'

export const Route = createFileRoute(
  '/_authed/campaigns/$dmUsername/$campaignSlug/categories/characters/',
)({
  component: CharactersPage,
  validateSearch: (search: Record<string, unknown>) => validateSearch(search),
})

function CharactersPage() {
  const navigate = useNavigate()
  const search = useSearch({
    from: '/_authed/campaigns/$dmUsername/$campaignSlug/categories/characters/',
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
      categorySlug="characters"
      currentFolderId={search.folderId}
      onNavigate={handleFolderNavigation}
      TagDialogComponent={CharacterTagDialog}
    />
  )
}
