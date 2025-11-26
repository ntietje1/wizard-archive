import { Id } from '../_generated/dataModel'
import { Tag } from '../tags/types'

export type Location = Tag & {
  tagId: Id<'tags'>
  locationId: Id<'locations'>
}
