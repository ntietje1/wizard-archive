import { Migrations } from '@convex-dev/migrations'
import { components, internal } from './_generated/api'
import type { DataModel } from './_generated/dataModel'
import { getBlockSharePermissionLevelMigrationPatch } from './blockShares/permissionLevelMigration'
import { getDeleteBlockInlineContentProjectionFieldPatch } from './blocks/inlineContentMigration'
import {
  getResourceEmbedPropsMigrationPatch,
  isLegacySidebarItemEmbedProps,
} from './blocks/embedTargetMigration'
import { getCampaignDefaultFolderInheritSharesMigrationPatch } from './campaigns/defaultFolderInheritSharesMigration'
import { getFolderInheritSharesMigrationPatch } from './folders/inheritSharesMigration'
import {
  getLegacyNoteValueCompileFieldsCleanupPatch,
  getNoteValueCompileStateMigrationPatch,
} from './noteValues/compileState'
import { getSidebarItemLifecycleMigrationPatch } from './sidebarItems/lifecycleMigration'
import { getSidebarItemNormalizedNameMigrationPatch } from './sidebarItems/normalizedNameMigration'
import { getFileSystemTransactionVocabularyMigrationPatch } from './sidebarItems/filesystem/transactionVocabularyMigration'
import { getFileSystemSnapshotNormalizedNameMigrationPatch } from './sidebarItems/filesystem/snapshotNormalizedNameMigration'

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

export const migrateEmbedTargetResourceIds = migrations.define({
  table: 'blocks',
  batchSize: 100,
  migrateOne: async (ctx, block) => {
    if (block.type !== 'embed' || !isLegacySidebarItemEmbedProps(block.props)) return
    const target = await ctx.db.get('sidebarItems', block.props.sidebarItemId)
    return {
      props: getResourceEmbedPropsMigrationPatch(block.props, target?.resourceUuid ?? null),
    }
  },
})

export const backfillFolderInheritShares = migrations.define({
  table: 'folders',
  batchSize: 100,
  migrateOne: (_ctx, folder) => {
    return getFolderInheritSharesMigrationPatch(folder as { inheritShares?: boolean }) ?? undefined
  },
})

export const backfillCampaignDefaultFolderInheritShares = migrations.define({
  table: 'campaigns',
  batchSize: 100,
  migrateOne: (_ctx, campaign) => {
    return (
      getCampaignDefaultFolderInheritSharesMigrationPatch(
        campaign as { defaultFolderInheritShares?: boolean | null },
      ) ?? undefined
    )
  },
})

export const backfillNoteValueCompileState = migrations.define({
  table: 'noteValues',
  batchSize: 100,
  migrateOne: (_ctx, row) => getNoteValueCompileStateMigrationPatch(row) ?? undefined,
})

export const migrateFileSystemTransactionVocabulary = migrations.define({
  table: 'filesystemTransactions',
  batchSize: 100,
  migrateOne: (_ctx, row) =>
    getFileSystemTransactionVocabularyMigrationPatch(row) as Partial<typeof row> | undefined,
})

export const removeLegacyNoteValueCompileFields = migrations.define({
  table: 'noteValues',
  batchSize: 100,
  migrateOne: (_ctx, row) =>
    getLegacyNoteValueCompileFieldsCleanupPatch(row) as Partial<typeof row> | undefined,
})

export const backfillSidebarItemNormalizedName = migrations.define({
  table: 'sidebarItems',
  batchSize: 100,
  migrateOne: (_ctx, item) => getSidebarItemNormalizedNameMigrationPatch(item) ?? undefined,
})

export const backfillFileSystemSnapshotNormalizedNames = migrations.define({
  table: 'filesystemTransactions',
  batchSize: 100,
  migrateOne: (_ctx, row) =>
    getFileSystemSnapshotNormalizedNameMigrationPatch(row) as Partial<typeof row> | undefined,
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

export const runEmbedTargetResourceIdsMigration = migrations.runner(
  internal.migrations.migrateEmbedTargetResourceIds,
)

export const runBackfillFolderInheritSharesMigration = migrations.runner(
  internal.migrations.backfillFolderInheritShares,
)

export const runBackfillCampaignDefaultFolderInheritSharesMigration = migrations.runner(
  internal.migrations.backfillCampaignDefaultFolderInheritShares,
)

export const runBackfillNoteValueCompileStateMigration = migrations.runner(
  internal.migrations.backfillNoteValueCompileState,
)

export const runFileSystemTransactionVocabularyMigration = migrations.runner(
  internal.migrations.migrateFileSystemTransactionVocabulary,
)

export const runSidebarItemNormalizedNameMigration = migrations.runner(
  internal.migrations.backfillSidebarItemNormalizedName,
)

export const runFileSystemSnapshotNormalizedNameMigration = migrations.runner(
  internal.migrations.backfillFileSystemSnapshotNormalizedNames,
)

export const runRemoveLegacyNoteValueCompileFieldsMigration = migrations.runner(
  internal.migrations.removeLegacyNoteValueCompileFields,
)

export const runAll = migrations.runner([
  internal.migrations.migrateSidebarItemLifecycleStatus,
  internal.migrations.migrateBlockSharePermissionLevel,
  internal.migrations.deleteBlockInlineContentProjectionField,
  internal.migrations.migrateEmbedTargetResourceIds,
  internal.migrations.backfillCampaignDefaultFolderInheritShares,
  internal.migrations.backfillFolderInheritShares,
  internal.migrations.backfillNoteValueCompileState,
  internal.migrations.migrateFileSystemTransactionVocabulary,
  internal.migrations.removeLegacyNoteValueCompileFields,
])
