import { cn } from '~/lib/utils'
import { CategoryFolderButton } from './generic-category-folder/category-folder-button'
import { CharacterCategoryFolderContextMenu } from './character-system-folder/character-category-context-menu'
import { CharacterNoteContextMenu } from './character-system-folder/character-note-context-menu'
import { LocationCategoryFolderContextMenu } from './location-system-folder/location-category-context-menu'
import { LocationNoteContextMenu } from './location-system-folder/location-note-context-menu'
import { CHARACTER_CONFIG } from '~/components/forms/category-tag-dialogs/character-tag-dialog/types'
import { LOCATION_CONFIG } from '~/components/forms/category-tag-dialogs/location-tag-dialog/types'
import { SessionSystemFolder } from './session-system-folder/session-system-folder'
import { useCampaign } from '~/contexts/CampaignContext'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { CATEGORY_KIND, type TagCategory } from 'convex/tags/types'
import { createConfig } from '~/components/forms/category-tag-dialogs/generic-tag-dialog/types'

interface SystemFoldersProps {
  className?: string
}

export const SystemFolders = ({ className }: SystemFoldersProps) => {
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
      <SessionSystemFolder />

      {userCategories.map((c) => (
        <CategoryFolderButton key={c._id} categoryConfig={createConfig(c)} />
      ))}
    </div>
  )
}
