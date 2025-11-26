import { v } from 'convex/values'
import { folderValidator, folderValidatorFields } from '../folders/schema'
import { mapValidator } from '../gameMaps/schema'
import { noteValidator } from '../notes/schema'

export const sidebarItemValidator = v.union(
  noteValidator,
  folderValidator,
  mapValidator,
)

export const folderWithChildrenValidator = v.object({
  ...folderValidatorFields,
  children: v.optional(v.array(sidebarItemValidator)),
})
