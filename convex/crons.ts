import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.cron(
  'purge expired trash items',
  '0 3 * * *', // Daily at 03:00 UTC
  internal.sidebarItems.internalMutations.purgeExpiredTrash,
)

export default crons
