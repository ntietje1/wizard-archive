import { v } from 'convex/values'
import { fileWithContentValidator } from '../../files/schema'
import { folderWithContentValidator } from '../../folders/schema'
import { mapWithContentValidator } from '../../gameMaps/schema'
import { noteWithContentValidator } from '../../notes/schema'
import { canvasWithContentValidator } from '../../canvases/schema'

export const anySidebarItemWithContentValidator = v.union(
  noteWithContentValidator,
  mapWithContentValidator,
  folderWithContentValidator,
  fileWithContentValidator,
  canvasWithContentValidator,
)
