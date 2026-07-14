import { describe, expect, it } from 'vite-plus/test'

const architectureModule = await import('../../../../../scripts/resource-architecture.mjs')
const { analyzeResourceArchitecture, loadResourceArchitectureInputs } = architectureModule

describe('minimal resource architecture', () => {
  it('contains no prohibited production model or public export', () => {
    const { files, packageJson } = loadResourceArchitectureInputs()
    expect(analyzeResourceArchitecture(files, packageJson)).toEqual([])
  })

  it.each([
    [
      'provider_or_composite_identity',
      'packages/editor/src/resources/resource-record.ts',
      'type ProviderId = string',
    ],
    [
      'catalog_or_loading_duplication',
      'packages/editor/src/resources/resource-index-contract.ts',
      'ensureSubtree(id)',
    ],
    [
      'undo_or_universal_change_protocol',
      'packages/editor/src/resources/resource-command-contract.ts',
      'type UndoCommand = {}',
    ],
    [
      'dynamic_or_concurrent_versions',
      'packages/editor/src/resources/component-version.ts',
      'const vectorClock = {}',
    ],
    [
      'everyday_runtime_leakage',
      'packages/editor/src/resources/editor-runtime-contract.ts',
      'transfer: TransferService',
    ],
    [
      'client_owned_copy_mechanics',
      'packages/editor/src/resources/content-copy-contract.ts',
      'clientPlan: signedCopyPlan',
    ],
    [
      'broad_alias_or_guessing',
      'packages/editor/src/resources/source-path-alias.ts',
      'resolveByCurrentTitle()',
    ],
    [
      'alternate_portable_projection',
      'packages/editor/src/resources/portable-path-projector.ts',
      'new Intl.Segmenter()',
    ],
    [
      'overengineered_archive',
      'packages/editor/src/resources/wizard-archive-contract.ts',
      'trustClass: "signed"',
    ],
    ['legacy_convex_schema', 'convex/schema.ts', 'sidebarItems: defineTable({})'],
    ['superseded_module_path', 'convex/sidebarItems/mutations.ts', 'export const create = 1'],
  ])('rejects %s', (className, filePath, source) => {
    expect(
      analyzeResourceArchitecture([{ path: filePath, source }], { exports: {} }),
    ).toContainEqual({
      className,
      path: filePath,
    })
  })

  it('rejects removed package exports', () => {
    expect(
      analyzeResourceArchitecture([], {
        exports: { './resources/transaction-contract': './dist/transaction.mjs' },
      }),
    ).toContainEqual({
      className: 'legacy_public_export',
      path: './resources/transaction-contract',
    })
  })
})
