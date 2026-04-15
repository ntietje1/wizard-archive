import { v } from 'convex/values'
import { mapValidator } from '../../gameMaps/baseSchema'
import { noteValidator } from '../../notes/schema'
import { folderValidator } from '../../folders/baseSchema'
import { fileValidator } from '../../files/schema'
import { canvasValidator } from '../../canvases/baseSchema'

export const anySidebarItemValidator = v.union(
  noteValidator,
  folderValidator,
  mapValidator,
  fileValidator,
  canvasValidator,
)
