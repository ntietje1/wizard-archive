import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vite-plus/test'

import { createFolder, createNote } from '../../test/sidebar-item-factory'
import type { SidebarCacheSnapshot } from '../cache-patches'
import { createReadWriteTestCache } from './cache-test-utils'
import { commandFixtureItemIds, fileSystemCommandFixtures } from './command-fixtures'
import { RESOURCE_COMMAND_TYPE } from '../transaction-contract'
import { planFileSystemOptimisticCommand } from '../optimistic-planner'
import type { CampaignId } from '../../../../../shared/common/ids'

const campaignId = 'campaign_1' as CampaignId

function commandTypesInFile(relativePath: string) {
  const source = readFileSync(path.join(process.cwd(), relativePath), 'utf8')
  const matches = source.matchAll(/RESOURCE_COMMAND_TYPE\.([a-zA-Z]+)/g)
  return new Set(Array.from(matches, ([, commandType]) => commandType))
}

function sourceFor(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

describe('filesystem command exhaustiveness', () => {
  it('keeps receipt summary classification exhaustively mapped', () => {
    const source = sourceFor('packages/editor/src/filesystem/transaction-contract.ts')

    expect(source).toContain("satisfies Record<ResourceCommand['type']")
    expect(source).not.toContain("Partial<\n  Record<ResourceCommand['type']")
  })

  it('keeps progress messages exhaustively mapped', () => {
    const source = sourceFor('packages/editor/src/filesystem/progress-messages.ts')

    expect(source).toContain("satisfies Record<ResourceCommand['type']")
  })

  it('keeps optimistic planning guarded by an exhaustive switch', () => {
    const source = sourceFor('packages/editor/src/filesystem/optimistic-planner.ts')

    expect(source).toContain('assertNever(args.command)')
  })

  it('keeps create parent command options typed by the package command contract', () => {
    const transactionSource = sourceFor('packages/editor/src/filesystem/transaction-contract.ts')
    const runtimeSource = sourceFor('packages/editor/src/filesystem/operation-runtime-contract.ts')
    const itemCommandSource = sourceFor('packages/editor/src/filesystem/item-command-operations.ts')
    const lifecycleSource = sourceFor('packages/editor/src/filesystem/command-lifecycle.ts')
    const executorSource = sourceFor('packages/editor/src/filesystem/executor-runtime.ts')

    expect(transactionSource).toContain('export type ResourceCreateParentPlan')
    expect(transactionSource).toContain('export type ResourceCommandExecutionOptions')
    expect(runtimeSource).toContain('ResourceCommandExecutionOptions')
    expect(runtimeSource).toContain('ResourceCreateParentPlan')
    expect(itemCommandSource).toContain('ResourceCreateParentPlan')
    expect(lifecycleSource).toContain('createParentPlan')
    expect(executorSource).toContain('createParentPlan')
    expect(runtimeSource).not.toContain('createParentPlan?: unknown')
    expect(itemCommandSource).not.toContain('parentPlan?: unknown')
  })

  it('keeps command execution inputs owned by the package command contract', () => {
    const transactionSource = sourceFor('packages/editor/src/filesystem/transaction-contract.ts')
    const lifecycleSource = sourceFor('packages/editor/src/filesystem/command-lifecycle.ts')
    const executorSource = sourceFor('packages/editor/src/filesystem/executor-runtime.ts')
    const runtimeSource = sourceFor('packages/editor/src/filesystem/operation-runtime-contract.ts')

    expect(transactionSource).toContain('export type ResourceCommandDecisionRecord')
    expect(transactionSource).toContain('export type ResourceCommandMutationInput')
    expect(transactionSource).toContain('decisions?: ResourceCommandDecisionRecord')
    expect(lifecycleSource).toContain('ResourceCommandDecisionRecord')
    expect(lifecycleSource).toContain('ResourceCommandMutationInput')
    expect(executorSource).toContain('ResourceCommandExecutionOptions')
    expect(executorSource).toContain('ResourceCommandMutationInput')
    expect(runtimeSource).toContain('ResourceCommandMutationInput')
    expect(lifecycleSource).not.toContain('type FileSystemCommandMutationArgs')
    expect(executorSource).not.toContain('type ExecuteCommandOptions')
    expect(executorSource).not.toContain('type ExecuteFileSystemCommandMutation = (args: {')
  })

  it('keeps command branch types owned by the package command contract', () => {
    const transactionSource = sourceFor('packages/editor/src/filesystem/transaction-contract.ts')

    expect(transactionSource).toContain('export type ResourceCreateCommand')
    expect(transactionSource).toContain('export type ResourceRenameCommand')
  })

  it('keeps optimistic planning covered for every command type', () => {
    const fixtureItem = createNote({
      id: commandFixtureItemIds.source,
      name: 'Fixture',
    })
    const fixtureFolder = createFolder({
      id: commandFixtureItemIds.folder,
      name: 'Folder',
    })
    const snapshot: SidebarCacheSnapshot = { sidebar: [fixtureItem, fixtureFolder], trash: [] }
    const cacheAdapter = createReadWriteTestCache(snapshot)

    for (const commandType of Object.values(RESOURCE_COMMAND_TYPE)) {
      expect(() =>
        planFileSystemOptimisticCommand({
          command: fileSystemCommandFixtures[commandType],
          snapshot,
          readModel: cacheAdapter.getReadModel(),
          activeItemSurface: { parentId: null },
          currentUserId: null,
          workspaceId: campaignId,
        }),
      ).not.toThrow()
    }
  })

  it('keeps backend persistence validators and execution covered for every command type', () => {
    const expected = Object.keys(RESOURCE_COMMAND_TYPE).sort()
    const validatorsSource = sourceFor('convex/sidebarItems/filesystem/validators.ts')
    const mutationsSource = sourceFor('convex/sidebarItems/filesystem/mutations.ts')

    expect(
      Array.from(commandTypesInFile('convex/sidebarItems/filesystem/validators.ts')).sort(),
    ).toEqual(expected)
    expect(
      Array.from(commandTypesInFile('convex/sidebarItems/filesystem/mutations.ts')).sort(),
    ).toEqual(expected)
    expect(validatorsSource).toContain("satisfies Record<ResourceCommand['type']")
    expect(mutationsSource).toContain('assertNever(command)')
  })
})
