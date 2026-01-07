import { defineSchema } from 'convex/server'
import { notesTables } from './notes/schema'
import { foldersTables } from './folders/schema'
import { blocksTables } from './blocks/schema'
import { campaignTables } from './campaigns/schema'
import { editorTables } from './editors/schema'
import { userTables } from './users/schema'
import { sessionTables } from './sessions/schema'
import { shareTables } from './shares/schema'
import { fileStorageTables } from './storage/schema'
import { mapTables } from './gameMaps/schema'
import { filesTables } from './files/schema'

export default defineSchema({
  ...notesTables,
  ...foldersTables,
  ...blocksTables,
  ...editorTables,
  ...campaignTables,
  ...userTables,
  ...mapTables,
  ...sessionTables,
  ...shareTables,
  ...fileStorageTables,
  ...filesTables,
})
