import type { Id } from '../_generated/dataModel'
import type { DatabaseWriter, MutationCtx } from '../_generated/server'

export type CascadeItem = {
  id: Id<'sidebarItems'>
  campaignId: Id<'campaigns'>
}

export type Deletion = {
  deletionTime: number
  deletedBy: Id<'userProfiles'> | null
}

export type Cleared = {
  deletionTime: null
  deletedBy: null
}

export type SidebarItemTriggerHandlers = {
  onSoftDelete: (db: DatabaseWriter, item: CascadeItem, deletion: Deletion) => Promise<void>
  onRestore: (db: DatabaseWriter, item: CascadeItem, cleared: Cleared) => Promise<void>
  onHardDelete: (
    db: DatabaseWriter,
    storage: MutationCtx['storage'],
    item: CascadeItem,
  ) => Promise<Id<'_storage'> | null>
}
