import { defineSchema } from 'convex/server'
import { notesTables } from './notes/schema'
import { campaignTables } from './campaigns/schema'
import { editorTables } from './editors/schema'
import { userTables } from './users/schema'
import { characterTables } from './characters/schema'
import { locationTables } from './locations/schema'
import { tagTables } from './tags/schema'
import { sessionTables } from './sessions/schema'

export default defineSchema({
  ...notesTables,
  ...editorTables,
  ...campaignTables,
  ...userTables,
  ...characterTables,
  ...locationTables,
  ...tagTables,
  ...sessionTables,
})
