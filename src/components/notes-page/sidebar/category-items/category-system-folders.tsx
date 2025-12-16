import { cn } from '~/lib/shadcn/utils'
import { CategoryFolderButton } from './category-folder-button'
import { CharacterCategoryFolderContextMenu } from '~/components/context-menu/sidebar/character/character-category-context-menu'
import { CharacterNoteContextMenu } from '~/components/context-menu/sidebar/character/character-note-context-menu'
import { LocationCategoryFolderContextMenu } from '~/components/context-menu/sidebar/location/location-category-context-menu'
import { LocationNoteContextMenu } from '~/components/context-menu/sidebar/location/location-note-context-menu'
import { SessionCategoryFolderContextMenu } from '~/components/context-menu/sidebar/session/session-category-context-menu'
import { SessionNoteContextMenu } from '~/components/context-menu/sidebar/session/session-note-context-menu'
import { CHARACTER_CONFIG } from '~/components/forms/category-tag-form/character-tag-form/types'
import { LOCATION_CONFIG } from '~/components/forms/category-tag-form/location-tag-form/types'
import { useCampaign } from '~/contexts/CampaignContext'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { CATEGORY_KIND, type TagCategory } from 'convex/tags/types'
import { createConfig } from '~/components/forms/category-tag-form/generic-tag-form/types'
import { SESSION_CONFIG } from '~/components/forms/category-tag-form/session-tag-form/types'

interface CategorySystemFoldersProps {
  className?: string
}

export const CategorySystemFolders = ({
  className,
}: CategorySystemFoldersProps) => {
  const { campaignWithMembership } = useCampaign()
  const campaign = campaignWithMembership?.data?.campaign
  const categories = useQuery(
    convexQuery(
      api.tags.queries.getTagCategoriesByCampaign,
      campaign?._id ? { campaignId: campaign._id } : 'skip',
    ),
  )

  const userCategories: Array<TagCategory> = (categories.data || []).filter(
    (c: TagCategory) => c.kind === CATEGORY_KIND.User,
  )

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <CategoryFolderButton
        categoryConfig={CHARACTER_CONFIG}
        categoryContextMenu={CharacterCategoryFolderContextMenu}
        tagNoteContextMenu={CharacterNoteContextMenu}
      />
      <CategoryFolderButton
        categoryConfig={LOCATION_CONFIG}
        categoryContextMenu={LocationCategoryFolderContextMenu}
        tagNoteContextMenu={LocationNoteContextMenu}
      />
      <CategoryFolderButton
        categoryConfig={SESSION_CONFIG}
        categoryContextMenu={SessionCategoryFolderContextMenu}
        tagNoteContextMenu={SessionNoteContextMenu}
      />

      {userCategories.map((c) => (
        <CategoryFolderButton key={c._id} categoryConfig={createConfig(c)} />
      ))}
    </div>
  )
}
