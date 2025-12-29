import type { BaseTagFormValues } from '../base-tag-form/types'
import type { Id } from 'convex/_generated/dataModel'
import type { Location } from 'convex/locations/types'
import type { SidebarItemId } from 'convex/sidebarItems/types'

export interface LocationFormValues extends BaseTagFormValues {}

export const defaultLocationFormValues: LocationFormValues = {
  name: '',
  description: '',
  color: '#ef4444',
}
export interface LocationTagFormProps {
  mode: 'create' | 'edit'
  location: Location | null
  campaignId: Id<'campaigns'>
  categoryId: Id<'tagCategories'>
  parentId: SidebarItemId | undefined
  isOpen: boolean
  onClose: () => void
  onLocationCreated?: (locationId: Id<'locations'>) => void
}
