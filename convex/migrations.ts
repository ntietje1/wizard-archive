import { Migrations } from '@convex-dev/migrations'
import { components, internal } from './_generated/api'
import type { DataModel } from './_generated/dataModel'
import { getBlockSharePermissionLevelMigrationPatch } from './blockShares/permissionLevelMigration'
import { getDeleteBlockInlineContentProjectionFieldPatch } from './blocks/inlineContentMigration'
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

export const deleteBlockInlineContentProjectionField = migrations.define({
  table: 'blocks',
  batchSize: 100,
  migrateOne: (_ctx, block) => {
    const patch = getDeleteBlockInlineContentProjectionFieldPatch(
      block as { inlineContent?: unknown },
    )
    return patch as Partial<typeof block> | undefined
  },
})

export const runSidebarItemLifecycleStatusMigration = migrations.runner(
  internal.migrations.migrateSidebarItemLifecycleStatus,
)

export const runBlockSharePermissionLevelMigration = migrations.runner(
  internal.migrations.migrateBlockSharePermissionLevel,
)

export const runDeleteBlockInlineContentProjectionFieldMigration = migrations.runner(
  internal.migrations.deleteBlockInlineContentProjectionField,
)

export const runAll = migrations.runner([
  internal.migrations.migrateSidebarItemLifecycleStatus,
  internal.migrations.migrateBlockSharePermissionLevel,
  internal.migrations.deleteBlockInlineContentProjectionField,
])
