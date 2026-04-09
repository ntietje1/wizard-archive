import { defineSchema } from 'convex/server'
import { notesTables } from './notes/schema'
import { foldersTables } from './folders/baseSchema'
import { blocksTables } from './blocks/schema'
import { campaignTables } from './campaigns/schema'
import { editorTables } from './editors/schema'
import { userTables } from './users/schema'
import { sessionTables } from './sessions/schema'
import { blockShareTables } from './blockShares/schema'
import { sidebarShareTables } from './sidebarShares/schema'
import { fileStorageTables } from './storage/schema'
import { gameMapsTables } from './gameMaps/baseSchema'
import { filesTables } from './files/schema'
import { bookmarkTables } from './bookmarks/schema'
import { userPreferencesTables } from './userPreferences/schema'
import { canvasesTables } from './canvases/baseSchema'
import { yjsSyncTables } from './yjsSync/schema'
import { editHistoryTables } from './editHistory/schema'
import { documentSnapshotsTables } from './documentSnapshots/schema'

export default defineSchema({
  ...notesTables,
  ...foldersTables,
  ...blocksTables,
  ...editorTables,
  ...campaignTables,
  ...userTables,
  ...gameMapsTables,
  ...sessionTables,
  ...blockShareTables,
  ...sidebarShareTables,
  ...fileStorageTables,
  ...filesTables,
  ...bookmarkTables,
  ...userPreferencesTables,
  ...canvasesTables,
  ...yjsSyncTables,
  ...editHistoryTables,
  ...documentSnapshotsTables,
})
