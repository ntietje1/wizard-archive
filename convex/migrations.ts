import { Migrations } from '@convex-dev/migrations'
import { components, internal } from './_generated/api'
import type { DataModel } from './_generated/dataModel'
import { getBlockSharePermissionLevelMigrationPatch } from './blockShares/permissionLevelMigration'
import { getSidebarItemLifecycleMigrationPatch } from './sidebarItems/lifecycleMigration'

export const migrations = new Migrations<DataModel>(components.migrations)
export const run = migrations.runner()

export const migrateSidebarItemLifecycleStatus = migrations.define({
  table: 'sidebarItems',
  batchSize: 100,
  migrateOne: (_ctx, item) => getSidebarItemLifecycleMigrationPatch(item) ?? undefined,
})

export const migrateBlockSharePermissionLevel = migrations.define({
  table: 'blockShares',
  batchSize: 100,
  migrateOne: (_ctx, share) => getBlockSharePermissionLevelMigrationPatch(share) ?? undefined,
})

export const runSidebarItemLifecycleStatusMigration = migrations.runner(
  internal.migrations.migrateSidebarItemLifecycleStatus,
)

export const runBlockSharePermissionLevelMigration = migrations.runner(
  internal.migrations.migrateBlockSharePermissionLevel,
)

export const runAll = migrations.runner([
  internal.migrations.migrateSidebarItemLifecycleStatus,
  internal.migrations.migrateBlockSharePermissionLevel,
])
