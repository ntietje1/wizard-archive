import { defineSchema } from 'convex/server'
import { notesTables } from './notes/schema'
import { foldersTables } from './folders/baseSchema'
import { blocksTables } from './blocks/schema'
import { campaignTables } from './campaigns/schema'
import { editorTables } from './editors/schema'
import { userTables } from './users/schema'
import { sessionTables } from './sessions/schema'
import { shareTables } from './shares/schema'
import { fileStorageTables } from './storage/schema'
import { gameMapsTables } from './gameMaps/baseSchema'
import { filesTables } from './files/schema'
import { bookmarkTables } from './bookmarks/schema'

export default defineSchema({
  ...notesTables,
  ...foldersTables,
  ...blocksTables,
  ...editorTables,
  ...campaignTables,
  ...userTables,
  ...gameMapsTables,
  ...sessionTables,
  ...shareTables,
  ...fileStorageTables,
  ...filesTables,
  ...bookmarkTables,
})
