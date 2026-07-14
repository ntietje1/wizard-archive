import { Triggers } from 'convex-helpers/server/triggers'
import type { MutationCtx } from './_generated/server'
import type { DataModel } from './_generated/dataModel'

export const triggers = new Triggers<DataModel, MutationCtx>()
