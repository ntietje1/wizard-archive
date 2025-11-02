import type { TagCategory } from 'convex/tags/types'
import type { Id } from 'convex/_generated/dataModel'

export interface CategoryFormProps {
  mode: 'create' | 'edit'
  category?: TagCategory
  campaignId?: Id<'campaigns'>
  onClose: () => void
  onSuccess?: (newSlug: string) => void
}
