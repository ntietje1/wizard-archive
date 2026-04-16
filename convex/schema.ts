import { defineSchema } from 'convex/server'
import { campaignTables } from './campaigns/schema'
import { editorTables } from './editors/schema'
import { userTables } from './users/schema'
import { sessionTables } from './sessions/schema'
import { blockShareTables } from './blockShares/schema'
import { sidebarShareTables } from './sidebarShares/schema'
import { fileStorageTables } from './storage/schema'
import { mapPinsTables } from './gameMaps/baseSchema'
import { bookmarkTables } from './bookmarks/schema'
import { userPreferencesTables } from './userPreferences/schema'
import { yjsSyncTables } from './yjsSync/schema'
import { editHistoryTables } from './editHistory/schema'
import { documentSnapshotsTables } from './documentSnapshots/schema'
import { sidebarItemsTables } from './sidebarItems/schema/sidebarItemsTable'
import { blocksTables } from './blocks/schema'
import { noteLinksTables } from './links/schema'

export default defineSchema({
  ...blocksTables,
  ...noteLinksTables,
  ...editorTables,
  ...campaignTables,
  ...userTables,
  ...mapPinsTables,
  ...sessionTables,
  ...blockShareTables,
  ...sidebarShareTables,
  ...fileStorageTables,
  ...bookmarkTables,
  ...userPreferencesTables,
  ...yjsSyncTables,
  ...editHistoryTables,
  ...documentSnapshotsTables,
  ...sidebarItemsTables,
})
