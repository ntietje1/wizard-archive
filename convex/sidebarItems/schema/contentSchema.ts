import { v } from 'convex/values'
import { mapWithContentValidator } from '../../gameMaps/schema'
import { noteWithContentValidator } from '../../notes/schema'
import { folderWithContentValidator } from '../../folders/schema'
import { fileWithContentValidator } from '../../files/schema'

export const anySidebarItemWithContentValidator = v.union(
  noteWithContentValidator,
  mapWithContentValidator,
  folderWithContentValidator,
  fileWithContentValidator,
)
