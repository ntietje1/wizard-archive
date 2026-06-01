import { Migrations } from '@convex-dev/migrations'
import { components, internal } from './_generated/api'
import type { DataModel } from './_generated/dataModel'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_STATUS } from '../shared/sidebar-items/types'

export const migrations = new Migrations<DataModel>(components.migrations)
export const run = migrations.runner()

const LEGACY_TRASH_LOCATION = 'trash'

type SidebarItemLifecycleMigrationInput = {
  location?: string
  status?: string
}

export function getSidebarItemLifecycleMigrationPatch(item: SidebarItemLifecycleMigrationInput) {
  const status = getMigratedSidebarItemStatus(item)

  if (item.location === SIDEBAR_ITEM_LOCATION.sidebar && item.status === status) {
    return null
  }

  return {
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    status,
  }
}

export const migrateSidebarItemLifecycleStatus = migrations.define({
  table: 'sidebarItems',
  batchSize: 100,
  migrateOne: (_ctx, item) => getSidebarItemLifecycleMigrationPatch(item) ?? undefined,
})

export const runSidebarItemLifecycleStatusMigration = migrations.runner(
  internal.migrations.migrateSidebarItemLifecycleStatus,
)

export const runAll = migrations.runner([internal.migrations.migrateSidebarItemLifecycleStatus])

function getMigratedSidebarItemStatus(item: SidebarItemLifecycleMigrationInput) {
  if (
    item.status === SIDEBAR_ITEM_STATUS.active ||
    item.status === SIDEBAR_ITEM_STATUS.trashed ||
    item.status === SIDEBAR_ITEM_STATUS.undoHidden
  ) {
    return item.status
  }

  return item.location === LEGACY_TRASH_LOCATION
    ? SIDEBAR_ITEM_STATUS.trashed
    : SIDEBAR_ITEM_STATUS.active
}
