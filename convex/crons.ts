import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.cron(
  'purge expired auth sessions and verification tokens',
  '0 4 * * *', // Daily at 04:00 UTC
  internal.auth.internalMutations.purgeExpiredAuthData,
)

export default crons
