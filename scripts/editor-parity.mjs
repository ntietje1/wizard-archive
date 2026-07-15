import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { editorParityContract } from './editor-parity-contract.mjs'
import { loadSourceFiles } from './source-files.mjs'

const expectedSlices = [
  'WIZ-258',
  'WIZ-259',
  'WIZ-260',
  'WIZ-261',
  'WIZ-262',
  'WIZ-263',
  'WIZ-264',
  'WIZ-265',
  'WIZ-266',
  'WIZ-269',
  'WIZ-267',
  'WIZ-268',
]

const allowedObsoleteAssertions = [
  'slug identity, custom links, and slug routes',
  'sibling-name conflicts and duplicate-name rejection',
  'keep-both numeric suffixes',
  'filename and path identity or validation',
  'migration and fallback decoders',
  'provider identities',
  'universal filesystem transactions and inverse patches',
  'note-value slug identity',
]

const requiredRestorationBehaviors = [
  'folder_dashboard_grid_cards_and_new_card',
  'persisted_workspace_preferences_and_editor_viewer_mode',
  'finite_assets_upload_destination',
  'current_resource_cards_and_previews',
  'item_history_snapshots_and_rollback',
  'canonical_browser_import_and_export',
  'campaign_member_session_and_storage_cleanup',
  'structural_and_content_undo',
  'empty_trash_workflow',
  'inherited_sharing_defaults',
  'realtime_collaboration',
  'cross_surface_embeds',
]

export function analyzeEditorParityContract(contract, deletedPaths) {
  const e2eInventory = indexE2eOwners(contract)
  return sortViolations([
    ...validateContractHeader(contract),
    ...e2eInventory.violations,
    ...validateDeletedPaths(contract, deletedPaths, e2eInventory.owners),
    ...validateDeletedPathRules(contract),
  ])
}

function validateContractHeader(contract) {
  const violations = []
  if (contract.reference.mergeBase !== '44535a28a7fd2a6b4c9c6e3e7e9b2dce72e5b8a9') {
    violations.push({ className: 'wrong_parity_reference', path: contract.reference.mergeBase })
  }
  if (contract.reference.visualSurfaces.length === 0) {
    violations.push({ className: 'missing_visual_reference', path: 'reference.visualSurfaces' })
  }
  if (JSON.stringify(contract.slices) !== JSON.stringify(expectedSlices)) {
    violations.push({ className: 'wrong_slice_order', path: 'slices' })
  }
  if (!contract.commitAfterEverySlice) {
    violations.push({ className: 'missing_slice_commit_rule', path: 'commitAfterEverySlice' })
  }
  if (JSON.stringify(contract.obsoleteAssertions) !== JSON.stringify(allowedObsoleteAssertions)) {
    violations.push({ className: 'expanded_obsolete_scope', path: 'obsoleteAssertions' })
  }
  if (
    JSON.stringify(Object.keys(contract.requiredBehaviorOwners)) !==
    JSON.stringify(requiredRestorationBehaviors)
  ) {
    violations.push({ className: 'incomplete_behavior_inventory', path: 'requiredBehaviorOwners' })
  }
  for (const [behavior, owners] of Object.entries(contract.requiredBehaviorOwners)) {
    if (owners.length === 0) violations.push({ className: 'ownerless_behavior', path: behavior })
  }
  return violations
}

function indexE2eOwners(contract) {
  const e2eOwners = new Map()
  const violations = []
  for (const group of contract.deletedE2eOwners) {
    for (const spec of group.specs) {
      if (e2eOwners.has(spec)) {
        violations.push({ className: 'duplicate_e2e_owner', path: `e2e/${spec}.spec.ts` })
      }
      e2eOwners.set(spec, group.owners)
    }
  }
  if (e2eOwners.size !== 47) {
    violations.push({ className: 'wrong_e2e_inventory_size', path: String(e2eOwners.size) })
  }
  return { owners: e2eOwners, violations }
}

function validateDeletedPaths(contract, deletedPaths, e2eOwners) {
  const violations = []
  for (const rawPath of deletedPaths) {
    const filePath = rawPath.replaceAll('\\', '/')
    const e2eMatch = /^e2e\/([^/]+)\.spec\.ts$/.exec(filePath)
    if (e2eMatch) {
      if (!e2eOwners.has(e2eMatch[1])) {
        violations.push({ className: 'unassigned_deleted_e2e', path: filePath })
      }
      continue
    }
    const owners = contract.deletedPathOwners.filter((entry) => entry.pattern.test(filePath))
    if (owners.length === 0) {
      violations.push({ className: 'unassigned_deleted_path', path: filePath })
    } else if (owners.length > 1) {
      violations.push({ className: 'ambiguous_deleted_path', path: filePath })
    }
  }
  return violations
}

function validateDeletedPathRules(contract) {
  const violations = []
  for (const entry of contract.deletedPathOwners) {
    if (entry.owners.length === 0) {
      violations.push({ className: 'ownerless_cluster', path: entry.cluster })
    }
    if (!['restore', 'redesign', 'superseded_artifact'].includes(entry.disposition)) {
      violations.push({ className: 'invalid_disposition', path: entry.cluster })
    }
  }
  return violations
}

export function analyzeEditorParityAcceptance(contract, files) {
  const violations = []
  const productionFiles = files.filter((file) => !/(?:^|\/)__tests__(?:\/|$)/.test(file.path))
  for (const surface of contract.acceptanceSurfaces) {
    if (!productionFiles.some((file) => surface.source.test(file.path))) {
      violations.push({ className: 'missing_surface_implementation', path: surface.id })
    }
    if (!files.some((file) => surface.test.test(file.path))) {
      violations.push({ className: 'missing_surface_behavior_test', path: surface.id })
    }
  }
  for (const file of productionFiles) {
    for (const placeholder of contract.forbiddenPlaceholders) {
      if (placeholder.pattern.test(file.source)) {
        violations.push({
          className: `placeholder_${placeholder.id}`,
          path: file.path,
        })
      }
    }
  }
  return sortViolations(violations)
}

export function loadEditorParityInputs(root = process.cwd()) {
  const deletedPaths = execFileSync(
    'git',
    [
      'diff',
      '--name-only',
      '--diff-filter=D',
      `${editorParityContract.reference.mergeBase}...HEAD`,
    ],
    { cwd: root, encoding: 'utf8' },
  )
    .split(/\r?\n/)
    .filter(Boolean)
  const files = loadSourceFiles(root, ['packages/editor/src', 'src/editor-adapters'])
  return { deletedPaths, files }
}

function sortViolations(violations) {
  return violations.sort((left, right) =>
    `${left.className}:${left.path}`.localeCompare(`${right.className}:${right.path}`),
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputs = loadEditorParityInputs()
  const violations = analyzeEditorParityContract(editorParityContract, inputs.deletedPaths)
  if (!process.argv.includes('--contract')) {
    violations.push(...analyzeEditorParityAcceptance(editorParityContract, inputs.files))
  }
  if (violations.length > 0) {
    console.error(
      sortViolations(violations)
        .map((violation) => `${violation.className}: ${violation.path}`)
        .join('\n'),
    )
    process.exitCode = 1
  }
}
