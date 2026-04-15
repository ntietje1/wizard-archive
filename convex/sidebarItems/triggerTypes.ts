import type { Id } from '../_generated/dataModel'
import type { DatabaseWriter, MutationCtx } from '../_generated/server'

export type CascadeItem = {
  id: Id<'sidebarItems'>
  campaignId: Id<'campaigns'>
}

export type SidebarItemTriggerHandlers = {
  onHardDelete: (
    db: DatabaseWriter,
    storage: MutationCtx['storage'],
    item: CascadeItem,
  ) => Promise<Id<'_storage'> | null>
}
