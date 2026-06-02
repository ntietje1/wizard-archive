import { Migrations } from '@convex-dev/migrations'
import { components, internal } from './_generated/api'
import type { DataModel } from './_generated/dataModel'
import { getSidebarItemLifecycleMigrationPatch } from './sidebarItems/lifecycleMigration'

export const migrations = new Migrations<DataModel>(components.migrations)
export const run = migrations.runner()

export const migrateSidebarItemLifecycleStatus = migrations.define({
  table: 'sidebarItems',
  batchSize: 100,
  migrateOne: (_ctx, item) => getSidebarItemLifecycleMigrationPatch(item) ?? undefined,
})

export const runSidebarItemLifecycleStatusMigration = migrations.runner(
  internal.migrations.migrateSidebarItemLifecycleStatus,
)

export const runAll = migrations.runner([internal.migrations.migrateSidebarItemLifecycleStatus])
