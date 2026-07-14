import { defineSchema } from 'convex/server'
import { campaignTables } from './campaigns/schema'
import { userTables } from './users/schema'
import { sessionTables } from './sessions/schema'
import { fileStorageTables } from './storage/schema'
import { userPreferencesTables } from './userPreferences/schema'
import { resourceTables } from './resources/schema'

export default defineSchema({
  ...campaignTables,
  ...userTables,
  ...sessionTables,
  ...fileStorageTables,
  ...userPreferencesTables,
  ...resourceTables,
})
